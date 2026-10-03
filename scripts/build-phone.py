"""
Build the portfolio's phone in Blender, bake its AO, and export it for the site.
The brief, including the node contract the site code relies on, is
assets/device-models/PROMPT-phone.md.

Run inside Blender with assets/device-models/devices.blend open:

    p = r"I:/Self projects with AI/Portfolio/ZIP/Portfolio-Website/scripts/build-phone.py"
    ns = {"__file__": p}; exec(compile(open(p).read(), p, "exec"), ns)
    ns["build"]()     # geometry, materials, UVs (rebuilds the Phone scene only)
    ns["bake"]()      # AO atlas -> assets/device-models/phone-ao.jpg
    ns["export"]()    # -> public/models/phone.glb
    ns["verify"]()    # BODY box, SCREEN size and UVs, triangles, nodes, materials

It works only in its own scene, "Phone", and refuses to run in any file but
devices.blend.

The look is an iPhone 17 Pro Max, unbranded: flat frame with soft edges and
antenna lines, a full-width camera plateau across the top of the back with
the three lenses at the brief's positions, flash and LiDAR on its right, a
frosted glass back below it and "Ahnaf" where Apple puts its logo.

Shared materials
----------------
devices.blend also holds the laptop, whose MAT_Screen, MAT_Bezel and
MAT_Accent carry the names this brief needs too. Materials are file-wide, so
this script reuses those three exactly as they are (their settings fit the
phone brief) and only creates or edits the phone's own four materials. The
AO bake swaps slots on the phone's meshes rather than adding nodes to them.
"""

import bpy
import bmesh
import math
import os
from mathutils import Euler, Matrix, Vector

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(REPO, "assets", "device-models", "devices.blend")
AO_JPG = os.path.join(REPO, "assets", "device-models", "phone-ao.jpg")
GLB = os.path.join(REPO, "public", "models", "phone.glb")
FONT = os.path.join(REPO, "public", "fonts", "GreaterTheory.otf")   # the site's hero-name face

SCENE = "Phone"
COLL = "Phone_Model"

# ---- dimensions (site units; -Y is the screen side, +Z up) ----
W, H, DEPTH = 1.44, 3.02, 0.17
YF, YB = -DEPTH / 2, DEPTH / 2           # front / back faces
R_BODY = 0.26                            # corner radius in the front view
EDGE = 0.012                             # soft front / back edge bevel
SCREEN_W, SCREEN_H, SCREEN_R, SCREEN_Y = 1.42, 3.00, 0.25, -0.0855
BACK_RIM = 0.03                          # frame rim around the back glass
BACK_POCKET = 0.004                      # glass sits in a pocket this deep
PLATEAU_Z0, PLATEAU_RISE = 0.60, 0.028   # full-width camera plateau
LENS_CLUSTER = (-0.32, 0.98)             # the brief's plateau centre
LENSES = [(-0.47, 1.13), (-0.17, 1.13), (-0.32, 0.83)]
LENS_RING, LENS_GLASS, LENS_PROUD = 0.115, 0.082, 0.03
# Object names are unique per .blend and the laptop already owns "SCREEN", so
# the phone's screen is SCREEN.phone in Blender and renamed to SCREEN in the
# exported .glb (export() rewrites the node and mesh names).
SCREEN_OBJ = "SCREEN.phone"
GLB_RENAMES = {SCREEN_OBJ: "SCREEN"}
NAME = "Ahnaf"
NAME_Z = -0.30                           # Apple-logo position on the 17 Pro back
SEG = 32                                 # brief: circles 32 segments at most

# ---- materials (exactly these names, max 7) ----
TI, GLASS, SCREEN, BEZEL, LENS, PLATE, ACCENT = range(7)
MAT_NAMES = ["MAT_Titanium", "MAT_BackGlass", "MAT_Screen", "MAT_Bezel", "MAT_LensGlass",
             "MAT_CameraPlate", "MAT_Accent"]
SHARED = {SCREEN, BEZEL, ACCENT}         # also used by the laptop: reuse, never edit
AO_MATS = (TI, GLASS, PLATE)


# ---------------------------------------------------------------- utilities

def hex_rgba(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], 1.0)


def sock(node, ident):
    return next(s for s in node.inputs if s.identifier == ident)


def enum_ids(struct, prop):
    return [i.identifier for i in struct.bl_rna.properties[prop].enum_items]


def guard():
    if os.path.normcase(os.path.abspath(bpy.data.filepath)) != os.path.normcase(BLEND):
        raise RuntimeError(f"open {BLEND} first (current file: {bpy.data.filepath or 'unsaved'})")


def get_scene():
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    if bpy.context.window and bpy.context.window.scene != sc:
        bpy.context.window.scene = sc
    return sc


def view3d():
    for area in bpy.context.window.screen.areas:
        if area.type == "VIEW_3D":
            return area, next(r for r in area.regions if r.type == "WINDOW")
    return None, None


def set_engine(sc, want):
    for eng in want:
        try:
            sc.render.engine = eng
            return
        except TypeError:
            continue


# ---------------------------------------------------------------- materials

def principled(name, base, metallic=0.0, rough=0.5, emit=None, strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if mat.node_tree is None:
        try:
            mat.use_nodes = True
        except AttributeError:
            pass
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (-300, 0)
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    sock(bsdf, "Base Color").default_value = base
    sock(bsdf, "Metallic").default_value = metallic
    sock(bsdf, "Roughness").default_value = rough
    if emit:
        sock(bsdf, "Emission Color").default_value = emit
        sock(bsdf, "Emission Strength").default_value = strength
    mat.diffuse_color = base
    return mat


def make_materials():
    own = {
        TI: lambda: principled("MAT_Titanium", hex_rgba("#5E5D5A"), metallic=0.95, rough=0.3),
        GLASS: lambda: principled("MAT_BackGlass", hex_rgba("#26282C"), metallic=0.25, rough=0.8),
        LENS: lambda: principled("MAT_LensGlass", hex_rgba("#050608"), rough=0.1),
        PLATE: lambda: principled("MAT_CameraPlate", hex_rgba("#2E3034"), metallic=0.5, rough=0.45),
    }
    shared = {   # created only if the file doesn't have them yet; never edited
        SCREEN: lambda: principled("MAT_Screen", hex_rgba("#000000"), rough=0.4),
        BEZEL: lambda: principled("MAT_Bezel", hex_rgba("#050506"), rough=0.18),
        ACCENT: lambda: principled("MAT_Accent", hex_rgba("#000000"), rough=0.4,
                                   emit=hex_rgba("#CC182C"), strength=2.0),
    }
    mats = []
    for i, name in enumerate(MAT_NAMES):
        if i in SHARED:
            mats.append(bpy.data.materials.get(name) or shared[i]())
        else:
            mats.append(own[i]())
    return mats


def hook_ao(mats, image):
    """AO image -> Separate Color (R) -> glTF Material Output.Occlusion on the
    phone's own three AO materials. The image node is left active for baking."""
    group = bpy.data.node_groups.get("glTF Material Output")
    if group is None:
        group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        group.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    for i in AO_MATS:
        nt = mats[i].node_tree
        for n in [n for n in nt.nodes if n.type in ("TEX_IMAGE", "SEPARATE_COLOR", "GROUP")]:
            nt.nodes.remove(n)
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.location = (-800, -300)
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        sep.location = (-520, -300)
        grp = nt.nodes.new("ShaderNodeGroup")
        grp.node_tree = group
        grp.location = (-300, -420)
        nt.links.new(tex.outputs["Color"], sep.inputs[0])
        nt.links.new(sep.outputs[0], grp.inputs["Occlusion"])
        nt.nodes.active = tex


# ---------------------------------------------------------------- mesh helpers

def rrect(cx, cy, w, h, r, segs=8):
    """Rounded rectangle as 2D points, counter-clockwise."""
    pts = []
    for (ox, oy), a0 in (((cx + w / 2 - r, cy - h / 2 + r), -90), ((cx + w / 2 - r, cy + h / 2 - r), 0),
                         ((cx - w / 2 + r, cy + h / 2 - r), 90), ((cx - w / 2 + r, cy - h / 2 + r), 180)):
        for i in range(segs + 1):
            a = math.radians(a0 + 90 * i / segs)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def prism(bm, pts, z0, z1, mat):
    """Extrude a counter-clockwise outline from z0 to z1 (outward normals)."""
    n = len(pts)
    b = [bm.verts.new((x, y, z0)) for x, y in pts]
    t = [bm.verts.new((x, y, z1)) for x, y in pts]
    faces = [bm.faces.new(t), bm.faces.new(list(reversed(b)))]
    faces += [bm.faces.new((b[i], b[(i + 1) % n], t[(i + 1) % n], t[i])) for i in range(n)]
    for f in faces:
        f.material_index = mat
    return faces[0], faces[1]


def box(bm, x0, x1, y0, y1, z0, z1, mat):
    prism(bm, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, mat)


def bevel(bm, edges, offset, segs):
    # material=-1: bevel faces take the adjacent material (the op defaults to slot 0)
    if edges:
        bmesh.ops.bevel(bm, geom=list(edges), offset=offset, offset_type="OFFSET", segments=segs,
                        profile=0.5, affect="EDGES", clamp_overlap=True, material=-1)


def cap_face(bm, sign):
    """Largest face whose normal points along +Z (sign 1) or -Z (sign -1)."""
    bm.normal_update()
    return max((f for f in bm.faces if f.normal.z * sign > 0.99), key=lambda f: f.calc_area())


def merge(dst, src):
    vmap = {v: dst.verts.new(v.co) for v in src.verts}
    for f in src.faces:
        dst.faces.new([vmap[v] for v in f.verts]).material_index = f.material_index


def to_back(bm):
    """Things built flat in XY facing +Z, turned to face +Y (the back).
    Rx(-90) maps (x, y, z) -> (x, z, -y): XY outline y becomes height z."""
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.radians(-90), 4, "X"), verts=bm.verts)


def mesh_object(name, bm, mats, coll, parent=None, location=(0, 0, 0)):
    """Object whose material slots are only the materials it uses."""
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    used = sorted({p.material_index for p in me.polygons})
    for i in used:
        me.materials.append(mats[i])
    remap = {old: new for new, old in enumerate(used)}
    me.polygons.foreach_set("material_index", [remap[p.material_index] for p in me.polygons])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.parent = parent
    ob.location = location
    return ob


def shift(bm, origin):
    bmesh.ops.translate(bm, vec=-Vector(origin), verts=bm.verts)


def bake_modifiers(ob):
    """Apply every modifier by replacing the mesh with its evaluated copy."""
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True,
                                          depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = new
    if old.users == 0:
        bpy.data.meshes.remove(old)
    new.name = ob.name           # after the old mesh is gone, so no ".001" suffix


def finish_shading(ob, angle=48):
    """Smooth faces, sharp edges above `angle`, face-area weighted normals."""
    me = ob.data
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.set_sharp_from_angle(angle=math.radians(angle))
    m = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    modes = enum_ids(m, "mode")
    m.mode = "FACE_AREA" if "FACE_AREA" in modes else modes[0]
    m.keep_sharp = True
    bake_modifiers(ob)


def disc_unit(bm, cx, cz, base_y, r_outer, height, steps, segs=SEG):
    """A round stack on the back: cylinder of r_outer rising `height` from
    base_y, top face stepped inward by `steps` = [(inset, depth, material)]."""
    t = bmesh.new()
    bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=segs, radius1=r_outer,
                          radius2=r_outer, depth=height,
                          matrix=Matrix.Translation((cx, -cz, height / 2)))
    for f in t.faces:
        f.material_index = PLATE
    bmesh.ops.delete(t, geom=[cap_face(t, -1)], context="FACES_ONLY")   # sits on the plateau
    bevel(t, cap_face(t, 1).edges, min(0.006, height * 0.3), 2)
    top = cap_face(t, 1)
    for inset, depth, mat in steps:
        bmesh.ops.inset_individual(t, faces=[top], thickness=inset, depth=depth, use_even_offset=True)
        top.material_index = mat
    to_back(t)
    bmesh.ops.translate(t, vec=(0, base_y, 0), verts=t.verts)
    merge(bm, t)
    t.free()


# ---------------------------------------------------------------- parts

def build_body(mats, coll, root):
    """Frame and band, front glass (black, under SCREEN), back pocket for the
    glass, buttons, antenna lines, USB-C port and speaker holes."""
    # Built in XY (outline x / height, extruded along Z), then Rx(+90) turns
    # (x, v, w) into (x, -w, v): the +Z cap becomes the front (-Y), the -Z cap the back.
    bm = bmesh.new()
    prism(bm, rrect(0, 0, W, H, R_BODY, 8), YF, YB, TI)
    bevel(bm, cap_face(bm, 1).edges, EDGE, 2)
    bevel(bm, cap_face(bm, -1).edges, EDGE, 2)
    cap_face(bm, 1).material_index = BEZEL                                # front glass
    bmesh.ops.inset_region(bm, faces=[cap_face(bm, -1)], thickness=BACK_RIM, depth=-BACK_POCKET)
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.radians(90), 4, "X"), verts=bm.verts)
    body = mesh_object("BODY", bm, mats, coll, root)

    # USB-C port and speaker / mic holes in the bottom edge. Cut into the
    # clean shell first: the exact boolean needs a non-self-intersecting mesh,
    # so buttons and antenna lines are added afterwards.
    cut = bmesh.new()
    prism(cut, rrect(0, 0, 0.20, 0.055, 0.027, 6), -H / 2 - 0.05, -H / 2 + 0.03, BEZEL)
    for x in (0.22, 0.27, 0.32, 0.37, 0.42):
        for s in (-1, 1):
            t = bmesh.new()
            bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=8, radius1=0.0125,
                                  radius2=0.0125, depth=0.07,
                                  matrix=Matrix.Translation((s * x, 0, -H / 2)))
            for f in t.faces:
                f.material_index = BEZEL
            merge(cut, t)
            t.free()
    # antenna lines: shallow grooves on the band's straight runs (cut in, so
    # BODY's box stays exactly 1.44 x 3.02 apart from the buttons)
    g, d = 0.004, 0.0008
    for z in (1.17, -1.17):
        box(cut, W / 2 - d, W / 2 + 0.02, -0.066, 0.066, z - g, z + g, PLATE)
        box(cut, -W / 2 - 0.02, -W / 2 + d, -0.066, 0.066, z - g, z + g, PLATE)
    for x in (0.16, -0.16):            # between the USB-C port and the speaker holes
        box(cut, x - g, x + g, -0.066, 0.066, H / 2 - d, H / 2 + 0.02, PLATE)
        box(cut, x - g, x + g, -0.066, 0.066, -H / 2 - 0.02, -H / 2 + d, PLATE)
    cutter = mesh_object("_phone_cutter", cut, mats, coll)
    m = body.modifiers.new("Ports", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.solver = "EXACT" if "EXACT" in enum_ids(m, "solver") else enum_ids(m, "solver")[0]
    m.object = cutter
    m.use_self = True
    if "TRANSFER" in enum_ids(m, "material_mode"):
        m.material_mode = "TRANSFER"
    bake_modifiers(body)
    cm = cutter.data
    bpy.data.objects.remove(cutter, do_unlink=True)
    bpy.data.meshes.remove(cm)
    size = [max(v.co[i] for v in body.data.vertices) - min(v.co[i] for v in body.data.vertices)
            for i in range(3)]
    if abs(size[0] - W) > 1e-3 or abs(size[1] - DEPTH) > 1e-3 or abs(size[2] - H) > 1e-3:
        raise RuntimeError(f"port boolean damaged the BODY shell: {size}")

    def parts(t):
        # buttons (protrude 0.012, on the flat band)
        for x0, x1, zc, h in ((-W / 2 - 0.012, -W / 2 + 0.002, 0.89, 0.16),   # action
                              (-W / 2 - 0.012, -W / 2 + 0.002, 0.51, 0.26),   # volume up
                              (-W / 2 - 0.012, -W / 2 + 0.002, 0.17, 0.26),   # volume down
                              (W / 2 - 0.002, W / 2 + 0.012, 0.49, 0.34)):    # power
            b = bmesh.new()
            box(b, x0, x1, -0.026, 0.026, zc - h / 2, zc + h / 2, TI)
            bevel(b, b.edges, 0.006, 2)
            merge(t, b)
            b.free()
        b = bmesh.new()                                                       # Camera Control
        box(b, W / 2 - 0.002, W / 2 + 0.004, -0.024, 0.024, -0.48, -0.28, LENS)
        bevel(b, b.edges, 0.0025, 1)
        merge(t, b)
        b.free()

    add_parts(body, parts, mats)
    finish_shading(body)
    return body


def add_parts(ob, build_fn, mats):
    """Merge extra geometry (built with the global material indices) into an
    object's mesh, adding any material slots it needs."""
    slots = {m.name: i for i, m in enumerate(ob.data.materials)}
    t = bmesh.new()
    build_fn(t)
    for f in t.faces:
        name = MAT_NAMES[f.material_index]
        if name not in slots:
            ob.data.materials.append(mats[f.material_index])
            slots[name] = len(ob.data.materials) - 1
        f.material_index = slots[name]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    merge(bm, t)
    t.free()
    bm.to_mesh(ob.data)
    bm.free()


def build_screen(mats, coll, root):
    """One flat rounded rectangle; UVs planar from its bounding rectangle."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    pts = rrect(0, 0, SCREEN_W, SCREEN_H, SCREEN_R, 8)
    f = bm.faces.new([bm.verts.new((x, 0.0, z)) for x, z in pts])      # CCW in (x, z): faces -Y
    f.material_index = SCREEN
    for loop in f.loops:
        x, z = loop.vert.co.x, loop.vert.co.z
        loop[uv].uv = ((x + SCREEN_W / 2) / SCREEN_W, (z + SCREEN_H / 2) / SCREEN_H)
    return mesh_object(SCREEN_OBJ, bm, mats, coll, root, (0, SCREEN_Y, 0))


def build_back(mats, coll, root):
    """Frosted back glass in the frame's pocket, with the name where Apple
    puts its logo, reading correctly from behind."""
    m = EDGE + BACK_RIM
    bm = bmesh.new()
    prism(bm, rrect(0, 0, W - 2 * m - 0.002, H - 2 * m - 0.002, R_BODY - m, 8),
          YB - BACK_POCKET, YB - 0.0002, GLASS)
    bevel(bm, cap_face(bm, 1).edges, 0.0015, 1)
    to_back(bm)   # Rx(-90): z -> y, so y runs YB - pocket .. YB - 0.0002, outer face +Y

    font = bpy.data.fonts.load(FONT, check_existing=True)
    cu = bpy.data.curves.new("_phone_name", "FONT")
    cu.body, cu.font, cu.size, cu.resolution_u, cu.space_character = NAME, font, 0.11, 4, 1.05
    ob = bpy.data.objects.new("_phone_name", cu)
    bpy.data.collections[COLL].objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    t = bmesh.new()
    t.from_mesh(me)
    bpy.data.meshes.remove(me)
    t.normal_update()
    flip = [f for f in t.faces if f.normal.z < 0]
    if flip:
        bmesh.ops.reverse_faces(t, faces=flip)
    lo = Vector((min(v.co.x for v in t.verts), min(v.co.y for v in t.verts), 0))
    hi = Vector((max(v.co.x for v in t.verts), max(v.co.y for v in t.verts), 0))
    bmesh.ops.translate(t, vec=-(lo + hi) / 2, verts=t.verts)
    for f in t.faces:
        f.material_index = ACCENT
    # reading -> -X, up -> +Z, face -> +Y (as seen from behind the phone)
    bmesh.ops.transform(t, matrix=Matrix.Translation((0, YB + 0.0002, NAME_Z))
                        @ Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Rotation(math.radians(90), 4, "X"),
                        verts=t.verts)
    merge(bm, t)
    t.free()
    origin = (0, YB - BACK_POCKET / 2, 0)
    shift(bm, origin)
    back = mesh_object("BACK", bm, mats, coll, root, origin)
    finish_shading(back)
    return back


def plateau_outline():
    """Full-width plateau: top corners concentric with the body's, small
    radius at the bottom, inset just inside the back edge bevel."""
    inset = EDGE + 0.002
    r_top, r_bot = R_BODY - inset, 0.06
    cx, cz = W / 2 - R_BODY, H / 2 - R_BODY            # body corner centre
    xs = W / 2 - inset
    pts = []
    for (ox, oz), r, a0 in (((xs - r_bot, PLATEAU_Z0 + r_bot), r_bot, -90), ((cx, cz), r_top, 0),
                            ((-cx, cz), r_top, 90), ((-xs + r_bot, PLATEAU_Z0 + r_bot), r_bot, 180)):
        for i in range(9):
            a = math.radians(a0 + 90 * i / 8)
            pts.append((ox + r * math.cos(a), oz + r * math.sin(a)))
    return pts


def build_camera(mats, coll, root):
    """Plateau, three lenses, flash, LiDAR and mic. Origin at the lens
    cluster centre on the back face (the brief's plateau centre)."""
    bm = bmesh.new()
    top_y = YB + PLATEAU_RISE
    # plateau (built in XY with y = -z, then turned to the back)
    t = bmesh.new()
    prism(t, [(x, -z) for x, z in reversed(plateau_outline())], 0.0, PLATEAU_RISE + 0.001, TI)
    bevel(t, cap_face(t, 1).edges, 0.01, 2)
    bmesh.ops.delete(t, geom=[cap_face(t, -1)], context="FACES_ONLY")
    to_back(t)
    bmesh.ops.translate(t, vec=(0, YB - 0.001, 0), verts=t.verts)
    merge(bm, t)
    t.free()

    # lenses: satin ring standing LENS_PROUD above the plateau, glossy glass
    for x, z in LENSES:
        disc_unit(bm, x, z, top_y - 0.001, LENS_RING, LENS_PROUD + 0.001,
                  [(LENS_RING - 0.1, -0.002, PLATE), (0.1 - LENS_GLASS - 0.004, 0.0, PLATE),
                   (0.004, -0.004, LENS)])
    # flash (frosted), LiDAR (glossy) and the mic hole, on the plateau's right
    disc_unit(bm, 0.42, 1.14, top_y - 0.001, 0.062, 0.006, [(0.012, -0.0015, GLASS)], segs=24)
    disc_unit(bm, 0.42, 0.84, top_y - 0.001, 0.056, 0.005, [(0.012, -0.0015, LENS)], segs=24)
    disc_unit(bm, 0.24, 1.30, top_y - 0.0005, 0.012, 0.001, [(0.004, -0.0008, LENS)], segs=12)

    origin = (LENS_CLUSTER[0], YB, LENS_CLUSTER[1])
    shift(bm, origin)
    cam = mesh_object("CAMERA", bm, mats, coll, root, origin)
    finish_shading(cam, angle=40)
    return cam


def unwrap_atlas(objs):
    """Non-overlapping UVs across BODY, BACK and CAMERA for one AO map."""
    vl = bpy.context.view_layer
    for ob in vl.objects:
        ob.select_set(ob in objs)
    vl.objects.active = objs[0]
    area, region = view3d()
    with bpy.context.temp_override(area=area, region=region, active_object=objs[0],
                                   selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006,
                                 area_weight=0.6)
        bpy.ops.uv.pack_islands(margin=0.006, rotate=True)
        bpy.ops.object.mode_set(mode="OBJECT")
    for ob in objs:
        ob.select_set(False)


def setup_world(sc):
    """Preview only (not exported): a soft studio gradient. No lights or
    cameras live in this scene."""
    w = bpy.data.worlds.get("Phone_World") or bpy.data.worlds.new("Phone_World")
    sc.world = w
    if w.node_tree is None:
        try:
            w.use_nodes = True
        except AttributeError:
            pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    geo = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], out.inputs[0])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, hex_rgba("#4C5562")      # horizon and below
    els[1].position, els[1].color = 0.6, hex_rgba("#EEF2F7")      # bright overhead
    sock(bg, "Strength").default_value = 1.4
    w.light_settings.distance = 0.06


# ---------------------------------------------------------------- entry points

def build():
    guard()
    sc = get_scene()
    coll = bpy.data.collections.get(COLL) or bpy.data.collections.new(COLL)
    if coll.name not in sc.collection.children:
        sc.collection.children.link(coll)
    for ob in list(coll.all_objects):
        data = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if isinstance(data, bpy.types.Mesh) and data.users == 0:
            bpy.data.meshes.remove(data)

    mats = make_materials()
    setup_world(sc)
    set_engine(sc, ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"))
    for vt in ("Khronos PBR Neutral", "Standard"):
        try:
            sc.view_settings.view_transform = vt
            break
        except TypeError:
            continue

    root = bpy.data.objects.new("Phone", None)
    root.empty_display_size = 0.3
    coll.objects.link(root)
    body = build_body(mats, coll, root)
    build_screen(mats, coll, root)
    back = build_back(mats, coll, root)
    cam = build_camera(mats, coll, root)
    unwrap_atlas([body, back, cam])

    ao = bpy.data.images.get("PhoneAO")
    if ao is None:
        ao = bpy.data.images.new("PhoneAO", 512, 512, alpha=False)
        ao.generated_color = (1, 1, 1, 1)
    ao.colorspace_settings.is_data = True
    hook_ao(mats, ao)
    return sc


def _blur(a, r):
    """Three box-blur passes (about a gaussian) of radius r along both axes."""
    import numpy as np
    for _ in range(3):
        for axis in (0, 1):
            pad = [(0, 0), (0, 0)]
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis)
            hi = np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)
            a = (hi - lo) / (2 * r + 1)
    return a


def bake(samples=96):
    """Soft, subtle AO for BODY / BACK / CAMERA into one 512 px JPEG."""
    import numpy as np
    guard()
    sc = get_scene()
    objs = [bpy.data.objects[n] for n in ("BODY", "BACK", "CAMERA")]
    mats = [bpy.data.materials[n] for n in MAT_NAMES]
    img = bpy.data.images.new("_phone_ao_bake", 512, 512, alpha=False, float_buffer=True)
    img.colorspace_settings.is_data = True
    hook_ao(mats, img)

    # every slot needs an image node to bake into; for the non-AO materials
    # (two of them shared with the laptop) swap in a throwaway material on the
    # phone's own meshes instead of touching them
    dummy_img = bpy.data.images.new("_phone_bake_dummy", 8, 8)
    dummy = bpy.data.materials.new("_phone_bake_dummy")
    try:
        dummy.use_nodes = True
    except AttributeError:
        pass
    node = dummy.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = dummy_img
    dummy.node_tree.nodes.active = node
    swapped = []
    for ob in objs:
        for i, m in enumerate(ob.data.materials):
            if m.name not in (MAT_NAMES[k] for k in AO_MATS):
                swapped.append((ob.data, i, m))
                ob.data.materials[i] = dummy

    engine = sc.render.engine
    set_engine(sc, ("CYCLES",))
    sc.cycles.samples = samples
    sc.cycles.device = "CPU"
    sc.world.light_settings.distance = 0.06
    vl = bpy.context.view_layer
    for ob in vl.objects:
        ob.select_set(ob in objs)
    vl.objects.active = objs[0]
    try:
        bpy.ops.object.bake(type="AO", margin=6, use_clear=True, target="IMAGE_TEXTURES")
    finally:
        for me, i, m in swapped:
            me.materials[i] = m
        bpy.data.materials.remove(dummy)
        bpy.data.images.remove(dummy_img)
        set_engine(sc, (engine,))
        for ob in objs:
            ob.select_set(False)

    px = np.array(img.pixels[:], dtype=np.float32).reshape(512, 512, 4)[..., 0]
    px = _blur(px, 1)
    px = np.clip(0.45 + 0.55 * px, 0, 1)                   # subtle: never darker than 0.45
    out = bpy.data.images.new("_phone_ao_out", 512, 512, alpha=False)
    out.colorspace_settings.is_data = True
    out.pixels[:] = np.dstack([px, px, px, np.ones_like(px)]).ravel().tolist()
    out.filepath_raw = AO_JPG
    out.file_format = "JPEG"
    out.save(filepath=AO_JPG, quality=88)
    bpy.data.images.remove(out)
    bpy.data.images.remove(img)
    old = bpy.data.images.get("PhoneAO")
    if old:
        bpy.data.images.remove(old)
    ao = bpy.data.images.load(AO_JPG, check_existing=False)
    ao.name = "PhoneAO"
    ao.colorspace_settings.is_data = True
    try:
        ao.filepath = bpy.path.relpath(AO_JPG)
    except ValueError:
        pass
    hook_ao(mats, ao)
    return AO_JPG


def export(path=GLB):
    guard()
    sc = get_scene()
    root = bpy.data.objects["Phone"]
    keep = [root] + list(root.children_recursive)
    for ob in sc.objects:
        ob.select_set(ob in keep)
    bpy.context.view_layer.objects.active = root
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, use_active_scene=True,
        export_yup=True, export_apply=True, export_materials="EXPORT",
        export_image_format="AUTO", export_texcoords=True, export_normals=True,
        export_tangents=False, export_animations=False, export_cameras=False,
        export_lights=False, export_draco_mesh_compression_enable=False, export_extras=False)
    for ob in sc.objects:
        ob.select_set(False)
    rename_glb(path, GLB_RENAMES)
    return path, os.path.getsize(path)


def rename_glb(path, renames):
    """Rename nodes and meshes inside a .glb's JSON chunk (BIN chunk untouched)."""
    import json
    import struct
    with open(path, "rb") as fh:
        data = fh.read()
    magic, version, _ = struct.unpack_from("<4sII", data, 0)
    jlen = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    for key in ("nodes", "meshes"):
        for item in gltf.get(key, []):
            if item.get("name") in renames:
                item["name"] = renames[item["name"]]
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    rest = data[20 + jlen:]
    with open(path, "wb") as fh:
        fh.write(struct.pack("<4sII", magic, version, 20 + len(js) + len(rest)))
        fh.write(struct.pack("<I4s", len(js), b"JSON"))
        fh.write(js)
        fh.write(rest)


def verify():
    """Everything the brief's Verify step asks for, as a dict."""
    guard()
    sc = get_scene()
    dg = bpy.context.evaluated_depsgraph_get()
    report = {}

    def bbox(ob):
        ws = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        return [tuple(round(min(v[i] for v in ws), 4) for i in range(3)),
                tuple(round(max(v[i] for v in ws), 4) for i in range(3))]

    body = bpy.data.objects["BODY"]
    report["BODY_bbox"] = bbox(body)
    shell = [body.matrix_world @ v.co for v in body.data.vertices if abs(v.co.x) <= W / 2 + 1e-5]
    report["BODY_shell_size"] = tuple(round(max(v[i] for v in shell) - min(v[i] for v in shell), 4)
                                      for i in range(3))
    scr = bpy.data.objects[SCREEN_OBJ]
    ws = [scr.matrix_world @ v.co for v in scr.data.vertices]
    report["SCREEN_size"] = (round(max(v.x for v in ws) - min(v.x for v in ws), 4),
                             round(max(v.z for v in ws) - min(v.z for v in ws), 4))
    report["SCREEN_y"] = round(ws[0].y, 4)
    report["SCREEN_faces"] = len(scr.data.polygons)
    uvs = [d.uv for d in scr.data.uv_layers.active.data]
    report["SCREEN_uv_range"] = ((round(min(u.x for u in uvs), 4), round(max(u.x for u in uvs), 4)),
                                 (round(min(u.y for u in uvs), 4), round(max(u.y for u in uvs), 4)))
    root = bpy.data.objects["Phone"]
    nodes = [root] + list(root.children_recursive)
    tris = 0
    for ob in nodes:
        if ob.type == "MESH":
            me = ob.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            ob.evaluated_get(dg).to_mesh_clear()
    report["triangles"] = tris
    report["nodes"] = [(ob.name, ob.parent.name if ob.parent else None, ob.type,
                        tuple(round(v, 4) for v in ob.location),
                        [m.name for m in ob.data.materials] if ob.type == "MESH" else [])
                       for ob in nodes]
    report["modifiers"] = [ob.name for ob in nodes if getattr(ob, "modifiers", None) and len(ob.modifiers)]
    report["scene_extras"] = [ob.name for ob in sc.objects if ob not in nodes or ob.type in ("CAMERA", "LIGHT")]
    report["hidden"] = [ob.name for ob in sc.objects if ob.hide_viewport or ob.hide_get() or ob.hide_render]
    if os.path.exists(GLB):
        report["glb_bytes"] = os.path.getsize(GLB)
    return report


VIEWS = {   # view_rotation euler (deg), look-at, distance, lens
    "front": ((90, 0, 0), (0, 0, 0), 4.3, 50),
    "back": ((90, 0, 180), (0, 0, 0), 4.3, 50),
    "three_quarter": ((76, 0, 140), (0, 0, 0.1), 4.4, 50),
}


def view(name):
    rot, loc, dist, lens = VIEWS[name]
    area, _ = view3d()
    sp = area.spaces.active
    sp.shading.type = "RENDERED"
    sp.overlay.show_overlays = False
    sp.lens = lens
    r = sp.region_3d
    r.view_perspective = "PERSP"
    r.view_rotation = Euler([math.radians(a) for a in rot]).to_quaternion()
    r.view_location = loc
    r.view_distance = dist
