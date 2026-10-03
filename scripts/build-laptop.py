"""
Build the portfolio's laptop in Blender, bake its AO and contact shadow, and
export it for the site. The brief, including the node contract the site code
relies on, is assets/device-models/PROMPT-laptop.md.

Run inside Blender with assets/device-models/devices.blend open:

    p = r"I:/Self projects with AI/Portfolio/ZIP/Portfolio-Website/scripts/build-laptop.py"
    ns = {"__file__": p}; exec(compile(open(p).read(), p, "exec"), ns)
    ns["build"]()     # geometry, materials, UVs (rebuilds the Laptop scene only)
    ns["bake"]()      # AO atlas -> assets/device-models/laptop-ao.jpg
                      # contact shadow -> public/models/laptop-shadow.png
    ns["export"]()    # -> public/models/laptop.glb
    ns["verify"]()    # bounding boxes, closed-lid clearance, triangles, nodes

It works only in its own scene, "Laptop", and refuses to run in any file but
devices.blend, so the About section's file can't be touched by mistake.

Layout (Blender units = site units, -Y is the front, +Z up)
-----------------------------------------------------------
BASE is 3.06 x 2.00 x 0.08 centred on the origin. The aluminium body runs from
z -0.032 to +0.04 and the rubber feet take it to -0.04, so the box matches
the contract exactly. The keyboard sits in a well near the back, the trackpad
in a shallow recess at the front, and a notch along the back edge holds the
hinge barrel.

LID's origin is the hinge axis (0, 1.0, 0.04). In its rest pose it stands
upright with its body BEHIND the axis (local y 0.022..0.082), so rotating it
+90 degrees about X lays it flat over the keys, screen side down. The hinge
barrel is part of LID: it is coaxial with the hinge, so it turns in place.
"""

import bpy
import bmesh
import math
import os
from mathutils import Euler, Matrix, Vector

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(REPO, "assets", "device-models", "devices.blend")
AO_JPG = os.path.join(REPO, "assets", "device-models", "laptop-ao.jpg")
SHADOW_PNG = os.path.join(REPO, "public", "models", "laptop-shadow.png")
GLB = os.path.join(REPO, "public", "models", "laptop.glb")

SCENE = "Laptop"
COLL = "Laptop_Model"

# ---- dimensions (site units) ----
W, D = 3.06, 2.00
BASE_Z0, BASE_Z1 = -0.04, 0.04
BODY_Z0 = -0.032            # aluminium underside; feet reach BASE_Z0
R_PLAN = 0.13               # corner radius of base and lid
HINGE = (0.0, 1.0, 0.04)
LID_H, LID_T = 2.00, 0.06
LID_Y0 = 0.022              # lid front surface (LID space, behind the hinge axis)
SCREEN_Y = LID_Y0 - 0.016   # screen plane, 0.016 in front of the lid
BEZEL_Y0 = 0.008            # bezel glass front, just behind the screen
SCREEN_W, SCREEN_H = 2.92, 1.87
BEZEL_W, BEZEL_H = 3.00, 1.95
LOGO_R = 0.26

U = 0.165                   # key pitch
KEY_GAP = 0.024
WELL_Z = 0.034              # keyboard well floor = keycap bottoms
KEY_Z1 = 0.0435             # keycap tops (closed screen sits at 0.046)
KB_TOP = 0.88               # back edge of the function row
KB_X0 = -14.5 * U / 2

# ---- materials (exactly these, max 7) ----
ALU, KEYS, BEZEL, SCREEN, ACCENT, RUBBER, DARK = range(7)
MAT_NAMES = ["MAT_Aluminium", "MAT_Keys", "MAT_Bezel", "MAT_Screen", "MAT_Accent",
             "MAT_Rubber", "MAT_Dark"]
AO_MATS = (ALU, KEYS, DARK)


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


# ---------------------------------------------------------------- materials

def gltf_output_group():
    """The node group the glTF exporter reads the occlusion texture from."""
    ng = bpy.data.node_groups.get("glTF Material Output")
    if ng is None:
        ng = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        ng.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    return ng


def make_material(name, base, metallic=0.0, rough=0.5, emit=None, strength=0.0):
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
    mats = [
        make_material("MAT_Aluminium", hex_rgba("#C4C7CC"), metallic=0.9, rough=0.4),
        make_material("MAT_Keys", hex_rgba("#0E0F11"), rough=0.72),
        make_material("MAT_Bezel", hex_rgba("#050506"), rough=0.18),
        make_material("MAT_Screen", hex_rgba("#000000"), rough=0.4),
        make_material("MAT_Accent", hex_rgba("#000000"), rough=0.4,
                      emit=hex_rgba("#CC182C"), strength=2.0),
        make_material("MAT_Rubber", hex_rgba("#141416"), rough=0.95),
        make_material("MAT_Dark", hex_rgba("#2A2D31"), metallic=0.4, rough=0.35),
    ]
    return mats


def hook_ao(mats, image):
    """AO image -> Separate Color (R) -> glTF Material Output.Occlusion, on the
    three materials that share the baked atlas. The image node is left active
    so a re-bake writes into it."""
    group = gltf_output_group()
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

def rrect(cx, cy, w, h, r, segs=10):
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
    uv_s = src.loops.layers.uv.active
    uv_d = (dst.loops.layers.uv.active or dst.loops.layers.uv.new("UVMap")) if uv_s else None
    for f in src.faces:
        nf = dst.faces.new([vmap[v] for v in f.verts])
        nf.material_index = f.material_index
        if uv_s:
            for a, b in zip(nf.loops, f.loops):
                a[uv_d].uv = b[uv_s].uv


def box(bm, x0, x1, y0, y1, z0, z1, mat):
    prism(bm, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, mat)


def cylinder(bm, r, depth, segs, mat, matrix, caps=True):
    t = bmesh.new()
    bmesh.ops.create_cone(t, cap_ends=caps, cap_tris=False, segments=segs, radius1=r, radius2=r,
                          depth=depth, matrix=matrix)
    for f in t.faces:
        f.material_index = mat
    merge(bm, t)
    t.free()


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


def recentre(bm):
    """Move bm so its bounding-box centre is at the origin; return that centre."""
    lo = Vector((min(v.co[i] for v in bm.verts) for i in range(3)))
    hi = Vector((max(v.co[i] for v in bm.verts) for i in range(3)))
    c = (lo + hi) / 2
    bmesh.ops.translate(bm, vec=-c, verts=bm.verts)
    return c


def bake_modifiers(ob):
    """Apply every modifier by replacing the mesh with its evaluated copy."""
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True,
                                          depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = new
    new.name = ob.name
    if old.users == 0:
        bpy.data.meshes.remove(old)


def finish_shading(ob, angle=48):
    """Smooth faces, sharp edges above `angle`, face-area weighted normals:
    big flat faces stay flat and the bevels read as crisp rounded highlights."""
    me = ob.data
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.set_sharp_from_angle(angle=math.radians(angle))
    m = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    modes = enum_ids(m, "mode")
    m.mode = "FACE_AREA" if "FACE_AREA" in modes else modes[0]
    m.keep_sharp = True
    bake_modifiers(ob)


# ---------------------------------------------------------------- BASE

KB_ROWS = [
    [1.5] + [1.0] * 12 + [1.0],                         # esc, F1-F12, Touch ID
    [1.0] * 13 + [1.5],                                 # ` 1 ... = delete
    [1.5] + [1.0] * 13,                                 # tab Q ... ] \
    [1.75] + [1.0] * 11 + [1.75],                       # caps A ... ' return
    [2.25] + [1.0] * 10 + [2.25],                       # shift Z ... / shift
    [1.0, 1.0, 1.0, 1.25, 5.0, 1.25, 1.0, 1.0, "updown", 1.0],   # fn ctrl opt cmd space ...
]
KB_WELL = (KB_X0 - 0.02, -KB_X0 + 0.02, KB_TOP - 6 * U - 0.02, KB_TOP + 0.02)
TRACKPAD = (0.0, -0.56, 1.20, 0.72)                     # centre x, centre y, width, depth
GRILLE_X = (1.300, 1.333, 1.366, 1.399)
GRILLE_ROWS = 24
FEET = [(sx * 1.28, sy * 0.78) for sx in (-1, 1) for sy in (-1, 1)]


def base_cutter():
    """Everything carved out of the base, as one mesh in MAT_Dark: keyboard
    well, trackpad recess, hinge notch, speaker-grille holes and side ports."""
    bm = bmesh.new()
    x0, x1, y0, y1 = KB_WELL
    prism(bm, rrect((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0.03, 4), WELL_Z, 0.12, DARK)
    cx, cy, w, d = TRACKPAD
    prism(bm, rrect(cx, cy, w, d, 0.05, 6), BASE_Z1 - 0.0015, 0.12, DARK)
    box(bm, -1.27, 1.27, 0.976, 1.2, 0.014, 0.12, DARK)                     # hinge notch
    for sx in (-1, 1):
        for gx in GRILLE_X:
            for j in range(GRILLE_ROWS):
                x, y, h = sx * gx, 0.03 + j * 0.035, 0.006
                box(bm, x - h, x + h, y - h, y + h, BASE_Z1 - 0.004, 0.12, DARK)
    zc = 0.006                                                               # ports
    for y, w, h in ((0.36, 0.11, 0.022), (0.12, 0.085, 0.026), (-0.06, 0.085, 0.026)):
        box(bm, -1.6, -1.517, y - w / 2, y + w / 2, zc - h / 2, zc + h / 2, DARK)
    for y, w, h in ((0.3, 0.12, 0.03), (0.08, 0.085, 0.026), (-0.25, 0.2, 0.01)):
        box(bm, 1.517, 1.6, y - w / 2, y + w / 2, zc - h / 2, zc + h / 2, DARK)
    cylinder(bm, 0.014, 0.1, 12, DARK,
             Matrix.Translation((-1.55, -0.42, zc)) @ Matrix.Rotation(math.radians(90), 4, "Y"))
    return bm


def build_base(mats, coll, root):
    bm = bmesh.new()
    prism(bm, rrect(0, 0, W, D, R_PLAN, 12), BODY_Z0, BASE_Z1, ALU)
    bevel(bm, cap_face(bm, -1).edges, 0.02, 3)          # softly rounded underside
    bevel(bm, cap_face(bm, 1).edges, 0.012, 2)          # crisp chamfered top edge
    base = mesh_object("BASE", bm, mats, coll, root)

    cut = mesh_object("_base_cutter", base_cutter(), mats, coll)
    cut.hide_render = True
    m = base.modifiers.new("Carve", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.solver = "EXACT" if "EXACT" in enum_ids(m, "solver") else enum_ids(m, "solver")[0]
    m.object = cut
    if "TRANSFER" in enum_ids(m, "material_mode"):
        m.material_mode = "TRANSFER"
    bake_modifiers(base)
    cut_mesh = cut.data
    bpy.data.objects.remove(cut, do_unlink=True)
    bpy.data.meshes.remove(cut_mesh)

    # rubber feet, sunk 3 mm into the underside so they reach exactly BASE_Z0
    bm = bmesh.new()
    bm.from_mesh(base.data)
    slot = {m.name: i for i, m in enumerate(base.data.materials)}
    for x, y in FEET:
        t = bmesh.new()
        bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=20, radius1=0.08,
                              radius2=0.08, depth=0.011,
                              matrix=Matrix.Translation((x, y, BASE_Z0 + 0.0055)))
        bevel(t, cap_face(t, -1).edges, 0.003, 1)
        for f in t.faces:
            f.material_index = len(slot)
        merge(bm, t)
        t.free()
    base.data.materials.append(mats[RUBBER])
    bm.to_mesh(base.data)
    bm.free()
    finish_shading(base)
    return base


def build_keys(mats, coll, root):
    bm = bmesh.new()
    for r, row in enumerate(KB_ROWS):
        yc = KB_TOP - (r + 0.5) * U
        x = KB_X0
        for wu in row:
            if wu == "updown":                          # half-height up / down arrows
                for y0, y1 in ((yc, yc + U / 2), (yc - U / 2, yc)):
                    key_cap(bm, x + KEY_GAP / 2, x + U - KEY_GAP / 2,
                            y0 + KEY_GAP / 4, y1 - KEY_GAP / 4)
                x += U
                continue
            key_cap(bm, x + KEY_GAP / 2, x + wu * U - KEY_GAP / 2,
                    yc - U / 2 + KEY_GAP / 2, yc + U / 2 - KEY_GAP / 2)
            x += wu * U
    keys = mesh_object("KEYS", bm, mats, coll, root)
    finish_shading(keys)
    return keys


def key_cap(bm, x0, x1, y0, y1):
    """Keycap: a box with one bevel segment on its top and vertical edges; the
    hidden underside is dropped."""
    t = bmesh.new()
    box(t, x0, x1, y0, y1, WELL_Z, KEY_Z1, KEYS)
    bottom = cap_face(t, -1)
    bevel(t, [e for e in t.edges if e not in bottom.edges], 0.007, 1)
    bmesh.ops.delete(t, geom=[cap_face(t, -1)], context="FACES_ONLY")
    merge(bm, t)
    t.free()


# ---------------------------------------------------------------- LID and children

def to_lid_space(bm):
    """Prisms are built in XY (outline x / z_lid, extrusion w = -y); Rx(+90)
    turns (x, v, w) into (x, -w, v)."""
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.radians(90), 4, "X"), verts=bm.verts)


def build_lid(mats, coll, root):
    bm = bmesh.new()
    prism(bm, rrect(0, LID_H / 2, W, LID_H, R_PLAN, 12), -(LID_Y0 + LID_T), -LID_Y0, ALU)
    bevel(bm, cap_face(bm, 1).edges, 0.006, 2)          # front rim
    bevel(bm, cap_face(bm, -1).edges, 0.014, 2)         # softer back edge
    to_lid_space(bm)
    # hinge barrel on the hinge axis, so it turns in place as the lid closes
    cylinder(bm, 0.02, 2.5, 20, DARK, Matrix.Rotation(math.radians(90), 4, "Y"))
    # camera dot on the bezel's top margin
    cylinder(bm, 0.008, 0.0004, 12, DARK,
             Matrix.Translation((0, BEZEL_Y0 - 0.0002, LID_H / 2 + 0.955))
             @ Matrix.Rotation(math.radians(90), 4, "X"))
    lid = mesh_object("LID", bm, mats, coll, root, HINGE)
    finish_shading(lid)

    # BEZEL: black glass panel on the lid front, just behind the screen
    bm = bmesh.new()
    prism(bm, rrect(0, LID_H / 2, BEZEL_W, BEZEL_H, R_PLAN - 0.03, 10),
          -(LID_Y0 + 0.001), -BEZEL_Y0, BEZEL)
    bevel(bm, cap_face(bm, 1).edges, 0.0025, 1)
    to_lid_space(bm)
    c = recentre(bm)
    bezel = mesh_object("BEZEL", bm, mats, coll, lid, c)
    finish_shading(bezel)

    # SCREEN: one quad, UVs filling 0-1 (U left->right, V bottom->top), facing -Y
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    hw, hh = SCREEN_W / 2, SCREEN_H / 2
    f = bm.faces.new([bm.verts.new(co) for co in ((-hw, 0, -hh), (hw, 0, -hh), (hw, 0, hh), (-hw, 0, hh))])
    f.material_index = SCREEN
    for loop, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = co
    mesh_object("SCREEN", bm, mats, coll, lid, (0, SCREEN_Y, LID_H / 2))

    # LOGO: the round emblem on the back of the lid -- a raised ring with the
    # name inside it, all MAT_Accent. Built flat (reading +X, up +Y, facing +Z),
    # then turned so it reads correctly from behind the open lid and from
    # behind the closed one: reading -> -X, up -> +Z (lid space), face -> +Y.
    bm = logo_mesh()
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.pi, 4, "Z")
                        @ Matrix.Rotation(math.radians(90), 4, "X"), verts=bm.verts)
    logo = mesh_object("LOGO", bm, mats, coll, lid,
                       (0, LID_Y0 + LID_T - 0.0005, LID_H / 2))
    finish_shading(logo, angle=40)
    return lid


LOGO_TEXT = "Ahnaf"
LOGO_FONT = os.path.join(REPO, "public", "fonts", "GreaterTheory.otf")   # the site's hero-name face
LOGO_RING = 0.03            # ring width
LOGO_H = 0.0025             # how far the emblem stands proud of the lid


def logo_mesh():
    bm = bmesh.new()
    segs, ro, ri = 72, LOGO_R, LOGO_R - LOGO_RING
    ring = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        c, s = math.cos(a), math.sin(a)
        ring.append([bm.verts.new((r * c, r * s, z)) for r, z in
                     ((ro, 0.0), (ro, LOGO_H), (ri, LOGO_H), (ri, 0.0))])
    for i in range(segs):
        a, b = ring[i], ring[(i + 1) % segs]
        bm.faces.new((a[0], b[0], b[1], a[1]))           # outer wall
        bm.faces.new((a[2], a[1], b[1], b[2]))           # top
        bm.faces.new((b[3], a[3], a[2], b[2]))           # inner wall
    bevel(bm, [e for e in bm.edges if all(abs(v.co.z - LOGO_H) < 1e-7 for v in e.verts)
               and e.calc_length() > 1e-6 and len(e.link_faces) == 2], 0.0012, 1)

    # the name, extruded to the ring's height, centred in the ring
    font = bpy.data.fonts.load(LOGO_FONT, check_existing=True)
    cu = bpy.data.curves.new("_logo_txt", "FONT")
    cu.body, cu.font, cu.size = LOGO_TEXT, font, 0.13
    cu.resolution_u, cu.extrude, cu.space_character = 5, LOGO_H / 2, 1.05
    ob = bpy.data.objects.new("_logo_txt", cu)
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
    bmesh.ops.delete(t, geom=[f for f in t.faces if f.normal.z < -0.99], context="FACES_ONLY")
    lo = Vector((min(v.co.x for v in t.verts), min(v.co.y for v in t.verts), min(v.co.z for v in t.verts)))
    hi = Vector((max(v.co.x for v in t.verts), max(v.co.y for v in t.verts)))
    fit = min(1.0, 2 * (ri - 0.045) / (hi.x - lo.x))     # keep clear of the ring
    bmesh.ops.translate(t, vec=(-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z), verts=t.verts)
    bmesh.ops.scale(t, vec=(fit, fit, 1.0), verts=t.verts)
    merge(bm, t)
    t.free()
    for f in bm.faces:
        f.material_index = ACCENT
    return bm


def build_shadow(coll, root):
    """Ground plane for the contact shadow. No material on purpose: the brief
    caps the model at seven named materials and the site draws
    laptop-shadow.png on it itself (UVs fill 0-1, U = +X, V = +Y)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    hx, hy = 2.2, 1.6
    f = bm.faces.new([bm.verts.new(co) for co in ((-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0))])
    for loop, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = co
    me = bpy.data.meshes.new("SHADOW")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("SHADOW", me)
    coll.objects.link(ob)
    ob.parent = root
    ob.location = (0, 0, BASE_Z0 - 0.005)
    return ob


def unwrap_atlas(objs):
    """Non-overlapping UVs across BASE, KEYS and LID for one shared AO map."""
    vl = bpy.context.view_layer
    for ob in vl.objects:
        ob.select_set(ob in objs)
    vl.objects.active = objs[0]
    area, region = view3d()
    with bpy.context.temp_override(area=area, region=region, active_object=objs[0],
                                   selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004,
                                 area_weight=0.6)
        bpy.ops.uv.pack_islands(margin=0.004, rotate=True)
        bpy.ops.object.mode_set(mode="OBJECT")
    for ob in objs:
        ob.select_set(False)


# ---------------------------------------------------------------- scene setup

def setup_world(sc):
    """Preview only (not exported): a soft studio gradient so the aluminium
    has something to reflect. No lights or cameras live in this scene."""
    w = bpy.data.worlds.get("Laptop_World") or bpy.data.worlds.new("Laptop_World")
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
    els[0].position, els[0].color = 0.0, hex_rgba("#1A1F28")      # below the horizon
    els[1].position, els[1].color = 0.55, hex_rgba("#E4EAF2")     # bright overhead
    sock(bg, "Strength").default_value = 1.5
    w.light_settings.distance = 0.2


def set_engine(sc, want):
    for eng in want:
        try:
            sc.render.engine = eng
            return
        except TypeError:
            continue


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

    root = bpy.data.objects.new("Laptop", None)
    root.empty_display_size = 0.4
    coll.objects.link(root)
    base = build_base(mats, coll, root)
    keys = build_keys(mats, coll, root)
    lid = build_lid(mats, coll, root)
    build_shadow(coll, root)
    unwrap_atlas([base, keys, lid])

    ao = bpy.data.images.get("LaptopAO")
    if ao is None:
        ao = bpy.data.images.new("LaptopAO", 1024, 1024, alpha=False)
        ao.generated_color = (1, 1, 1, 1)
    ao.colorspace_settings.is_data = True
    hook_ao(mats, ao)
    return sc


def _blur(a, r):
    """Three box-blur passes (≈ gaussian) of radius r along both axes."""
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


def _bake(sc, objects, image, distance, samples):
    """Cycles AO bake of `objects` into `image` (each material's active image
    node must point at it). Restores the render engine afterwards."""
    engine = sc.render.engine
    set_engine(sc, ("CYCLES",))
    sc.cycles.samples = samples
    sc.cycles.device = "CPU"
    sc.world.light_settings.distance = distance
    vl = bpy.context.view_layer
    for ob in vl.objects:
        ob.select_set(ob in objects)
    vl.objects.active = objects[0]
    bpy.ops.object.bake(type="AO", margin=8, use_clear=True, target="IMAGE_TEXTURES")
    set_engine(sc, (engine,))


def bake(samples=96):
    """AO atlas for BASE/KEYS/LID (lid open) and the contact shadow."""
    import numpy as np
    guard()
    sc = get_scene()
    objs = {n: bpy.data.objects[n] for n in ("BASE", "KEYS", "LID", "SHADOW")}
    objs["LID"].rotation_euler = (0, 0, 0)
    mats = [bpy.data.materials[n] for n in MAT_NAMES]

    # ---- AO atlas: 1024 px, grey-scale, soft
    img = bpy.data.images.new("_ao_bake", 1024, 1024, alpha=False, float_buffer=True)
    img.colorspace_settings.is_data = True
    hook_ao(mats, img)
    dummy = bpy.data.images.new("_dummy", 8, 8)
    nt = mats[RUBBER].node_tree                       # BASE's feet must bake somewhere
    tmp = nt.nodes.new("ShaderNodeTexImage")
    tmp.image = dummy
    nt.nodes.active = tmp
    objs["SHADOW"].hide_render = True
    _bake(sc, [objs["BASE"], objs["KEYS"], objs["LID"]], img, 0.22, samples)
    nt.nodes.remove(tmp)
    bpy.data.images.remove(dummy)

    px = np.array(img.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)[..., 0]
    px = _blur(px, 1)
    px = np.clip(0.28 + 0.72 * px, 0, 1) ** 0.85          # soft, never darker than ~0.33
    out = bpy.data.images.new("_ao_out", 1024, 1024, alpha=False)
    out.colorspace_settings.is_data = True
    out.pixels[:] = np.dstack([px, px, px, np.ones_like(px)]).ravel().tolist()
    out.filepath_raw = AO_JPG
    out.file_format = "JPEG"
    out.save(filepath=AO_JPG, quality=88)
    bpy.data.images.remove(out)
    bpy.data.images.remove(img)
    old = bpy.data.images.get("LaptopAO")
    if old:
        bpy.data.images.remove(old)
    ao = bpy.data.images.load(AO_JPG, check_existing=False)
    ao.name = "LaptopAO"
    ao.colorspace_settings.is_data = True
    try:
        ao.filepath = bpy.path.relpath(AO_JPG)
    except ValueError:
        pass
    hook_ao(mats, ao)

    # ---- contact shadow: AO on a ground plane under the base, lid open
    size = 512
    sh = bpy.data.images.new("_shadow_bake", size, size, alpha=False, float_buffer=True)
    me = objs["SHADOW"].data.copy()
    probe = bpy.data.objects.new("_shadow_probe", me)
    bpy.data.collections[COLL].objects.link(probe)
    probe.matrix_world = objs["SHADOW"].matrix_world
    pm = bpy.data.materials.new("_shadow_probe")
    try:
        pm.use_nodes = True
    except AttributeError:
        pass
    node = pm.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = sh
    pm.node_tree.nodes.active = node
    me.materials.append(pm)
    _bake(sc, [probe], sh, 0.9, max(64, samples))
    a = np.array(sh.pixels[:], dtype=np.float32).reshape(size, size, 4)[..., 0]
    occ = np.clip(1.0 - a, 0, 1)
    occ = _blur(occ, 6)
    occ = occ / max(occ.max(), 1e-6)
    yy, xx = np.mgrid[0:size, 0:size] / (size - 1)
    edge = np.minimum.reduce([xx, 1 - xx, yy, 1 - yy])
    occ *= np.clip(edge / 0.08, 0, 1)                      # fades to 0 at the plane's border
    alpha = np.clip(occ ** 1.15 * 0.92, 0, 1)
    rgba = np.dstack([np.zeros_like(alpha)] * 3 + [alpha])
    png = bpy.data.images.new("_shadow_out", size, size, alpha=True)
    png.pixels[:] = rgba.ravel().tolist()
    png.filepath_raw = SHADOW_PNG
    png.file_format = "PNG"
    png.save(filepath=SHADOW_PNG)
    for datablock, store in ((png, bpy.data.images), (sh, bpy.data.images), (probe, bpy.data.objects),
                             (me, bpy.data.meshes), (pm, bpy.data.materials)):
        store.remove(datablock)
    objs["SHADOW"].hide_render = False
    return AO_JPG, SHADOW_PNG


def export(path=GLB):
    guard()
    sc = get_scene()
    root = bpy.data.objects["Laptop"]
    root.children_recursive  # noqa: B018 (ensures relations are fresh)
    bpy.data.objects["LID"].rotation_euler = (0, 0, 0)
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
    return path, os.path.getsize(path)


def _world_tree(names):
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for n in names:
        ob = bpy.data.objects[n]
        me = ob.evaluated_get(dg).to_mesh()
        off = len(verts)
        verts += [ob.matrix_world @ v.co for v in me.vertices]
        polys += [tuple(off + i for i in p.vertices) for p in me.polygons]
        ob.evaluated_get(dg).to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys), verts


def verify():
    """Everything the brief's Verify step asks for, as a dict."""
    guard()
    get_scene()
    dg = bpy.context.evaluated_depsgraph_get()
    lid = bpy.data.objects["LID"]
    report = {}

    def bbox(ob):
        ws = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        return [tuple(round(min(v[i] for v in ws), 4) for i in range(3)),
                tuple(round(max(v[i] for v in ws), 4) for i in range(3))]

    lid.rotation_euler = (0, 0, 0)
    dg.update()
    report["BASE_bbox"] = bbox(bpy.data.objects["BASE"])
    report["LID_bbox"] = bbox(lid)
    report["LID_origin"] = tuple(round(v, 4) for v in lid.matrix_world.translation)
    root = bpy.data.objects["Laptop"]
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
                        [m.name for m in ob.data.materials] if ob.type == "MESH" else [])
                       for ob in nodes]
    report["modifiers"] = [ob.name for ob in nodes if getattr(ob, "modifiers", None) and len(ob.modifiers)]
    report["scene_extras"] = [ob.name for ob in bpy.context.scene.objects
                              if ob not in nodes or ob.type in ("CAMERA", "LIGHT")]

    lid_parts = ["LID", "BEZEL", "SCREEN", "LOGO"]
    base_parts = ["BASE", "KEYS"]
    for label, angle in (("open", 0), ("closed", 90)):
        lid.rotation_euler = (math.radians(angle), 0, 0)
        dg.update()
        t_lid, v_lid = _world_tree(lid_parts)
        t_base, v_base = _world_tree(base_parts)
        report[f"{label}_overlaps"] = len(t_lid.overlap(t_base))
        if angle:
            keys_top = max(v.z for v in _world_tree(["KEYS"])[1])
            screen = _world_tree(["SCREEN"])[1]
            report["closed_screen_z"] = round(min(v.z for v in screen), 4)
            report["closed_keys_top_z"] = round(keys_top, 4)
            report["closed_screen_normal_z"] = round(
                (bpy.data.objects["SCREEN"].matrix_world.to_3x3() @ Vector((0, -1, 0))).z, 3)
            report["closed_lid_y_span"] = (round(min(v.y for v in v_lid), 3),
                                           round(max(v.y for v in v_lid), 3))
    lid.rotation_euler = (0, 0, 0)
    dg.update()
    if os.path.exists(GLB):
        report["glb_bytes"] = os.path.getsize(GLB)
    return report


VIEWS = {   # view_rotation euler (deg), look-at, distance, lens
    "front": ((78, 0, 0), (0, 0.3, 0.8), 4.6, 50),
    "back": ((58, 0, 180), (0, 0.0, 0.05), 4.4, 50),
    "three_quarter": ((62, 0, 36), (0, 0.2, 0.65), 5.0, 50),
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
