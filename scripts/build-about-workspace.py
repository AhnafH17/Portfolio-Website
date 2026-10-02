"""
Build the About section's 3D workspace in Blender and export it for the site.

Run inside Blender (Text Editor or Blender MCP):

    p = r"I:/Self projects with AI/Portfolio/ZIP/Portfolio-Website/scripts/build-about-workspace.py"
    ns = {"__file__": p}; exec(compile(open(p).read(), p, "exec"), ns)
    ns["build"]()          # whole model; build(upto=N) stops after step N
    ns["export"]()         # -> public/models/about-workspace.glb

Everything is built in its own scene, "AboutWorkspace". A rebuild wipes and
recreates only that scene's two collections, so other scenes in the file are
never touched.

Why it is structured the way it is
----------------------------------
The site recolours the glow at runtime, so every emissive part shares ONE
material, MAT_Accent_Emissive, and no texture carries accent colour.

The site also lifts platforms on hover and floats the whole model, so each
PLT_* / CUBE_Core / PANEL_* / TOWER_* is a separate object whose origin is the
centre of its bottom face, and whatever sits on a platform is parented to it.
Geometry is built in world space, then each object's origin is moved to its
bounding-box bottom centre; rotation and scale stay identity throughout.

Front of the model faces Blender -Y (glTF +Z after the +Y-up conversion).

The monitor UI comes from assets/about-workspace/screen-ui.png, drawn by
scripts/make-about-screen.py because PIL is not available inside Blender.
"""

import bpy
import bmesh
import json
import math
import os
from mathutils import Euler, Matrix, Vector

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREEN_PNG = os.path.join(REPO, "assets", "about-workspace", "screen-ui.png")
SCREEN_JSON = os.path.join(REPO, "assets", "about-workspace", "screen-ui.json")
GLB_OUT = os.path.join(REPO, "public", "models", "about-workspace.glb")
FONT_PATH = r"C:\Windows\Fonts\bahnschrift.ttf"

SCENE_NAME = "AboutWorkspace"
ROOT_NAME = "AboutWorkspace"
MODEL_COLL = "AboutWorkspace_Model"
PREVIEW_COLL = "AboutWorkspace_Preview"

# Material slot order shared by every builder; unused slots are dropped.
BODY, RECESS, ACCENT, LABEL, GLASS, SCREEN = range(6)
MAT_NAMES = ["MAT_Body", "MAT_Body_Recess", "MAT_Accent_Emissive",
             "MAT_Label", "MAT_Glass", "MAT_Screen"]

# Heights (metres). The footprint is 4 x 4, centred on the origin.
Z0 = 0.06            # top of the recessed plinth everything stands on
DESK_Z0 = 1.16       # underside of PLT_Desk (top of its static pedestal)
DZ = 1.42            # top of PLT_Desk
DZT = DZ + 0.34      # desk surface


# ---------------------------------------------------------------- utilities

def hex_rgba(h, a=1.0):
    """'#RRGGBB' (sRGB) -> linear RGBA, as Blender's colour picker stores it."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


def sock(node, ident):
    return next(s for s in node.inputs if s.identifier == ident)


def enum_ids(struct, prop):
    return [i.identifier for i in struct.bl_rna.properties[prop].enum_items]


# ---------------------------------------------------------------- scene setup

def get_scene():
    sc = bpy.data.scenes.get(SCENE_NAME) or bpy.data.scenes.new(SCENE_NAME)
    win = bpy.context.window
    if win is not None and win.scene != sc:
        win.scene = sc
    return sc


def get_coll(sc, name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in sc.collection.children:
        sc.collection.children.link(c)
    return c


def make_material(name, base, metallic=0.0, rough=0.5, emit=None, strength=0.0,
                  alpha=1.0, blended=False, cull=False):
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
    sock(bsdf, "Alpha").default_value = alpha
    sock(bsdf, "Emission Color").default_value = emit or (0, 0, 0, 1)
    sock(bsdf, "Emission Strength").default_value = strength
    mat.diffuse_color = (base[0], base[1], base[2], alpha)
    mat.use_backface_culling = cull
    methods = enum_ids(mat, "surface_render_method")
    want = "BLENDED" if blended else "DITHERED"
    if want in methods:
        mat.surface_render_method = want
    if blended and "BLEND" in enum_ids(mat, "blend_method"):
        mat.blend_method = "BLEND"
    return mat


def make_materials():
    body = make_material("MAT_Body", hex_rgba("#17191E"), metallic=0.55, rough=0.45)
    recess = make_material("MAT_Body_Recess", hex_rgba("#0D0F12"), metallic=0.55, rough=0.6)
    accent = make_material("MAT_Accent_Emissive", (0, 0, 0, 1), rough=0.4,
                           emit=hex_rgba("#CC182C"), strength=4.0)
    label = make_material("MAT_Label", hex_rgba("#C2CAD0"), rough=0.5,
                          emit=hex_rgba("#C2CAD0"), strength=0.3, cull=True)
    glass = make_material("MAT_Glass", hex_rgba("#C9D2DC"), rough=0.1, alpha=0.12, blended=True)
    # emission is replaced by screen-ui.png in hook_screen_texture()
    screen = make_material("MAT_Screen", (0, 0, 0, 1), rough=0.3,
                           emit=hex_rgba("#0D131B"), strength=1.2)
    return [body, recess, accent, label, glass, screen]


def hook_screen_texture(mat):
    """Feed screen-ui.png into MAT_Screen's emission (Base Color stays black)."""
    if not os.path.exists(SCREEN_PNG):
        return False
    img = bpy.data.images.load(SCREEN_PNG, check_existing=True)
    img.reload()
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.location = (-650, -150)
    sock(bsdf, "Emission Color").default_value = (1, 1, 1, 1)
    nt.links.new(tex.outputs[0], sock(bsdf, "Emission Color"))
    return True


def setup_world(sc):
    """Camera sees #0D131B; surfaces are lit and reflect a soft studio grey.

    MAT_Body is 55% metallic, so its faces mostly show reflections: against a
    near-black world they read as flat black. The site needs an environment map
    for the same reason (e.g. three.js RoomEnvironment through PMREM).
    """
    w = bpy.data.worlds.get("AboutWorkspace_World") or bpy.data.worlds.new("AboutWorkspace_World")
    sc.world = w
    if w.node_tree is None:
        try:
            w.use_nodes = True
        except AttributeError:
            pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    seen = nt.nodes.new("ShaderNodeBackground")
    sock(seen, "Color").default_value = hex_rgba("#0D131B")
    lit = nt.nodes.new("ShaderNodeBackground")
    sock(lit, "Color").default_value = hex_rgba("#5A6472")
    sock(lit, "Strength").default_value = 2.5
    path = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(path.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(lit.outputs[0], mix.inputs[1])
    nt.links.new(seen.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])


def setup_render(sc):
    """Preview only: Eevee + compositor bloom. Neither is exported."""
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    ee = sc.eevee
    for attr, val in (("use_shadows", True), ("use_raytracing", True), ("taa_samples", 16)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
    # Khronos PBR Neutral keeps the crimson saturated (AgX turns it salmon) and
    # is the same curve as three.js NeutralToneMapping, so the preview matches.
    for vt in ("Khronos PBR Neutral", "Standard"):
        try:
            sc.view_settings.view_transform = vt
            break
        except TypeError:
            continue

    ng = bpy.data.node_groups.get("AboutWorkspace_Bloom") or \
        bpy.data.node_groups.new("AboutWorkspace_Bloom", "CompositorNodeTree")
    ng.nodes.clear()
    if not any(i.item_type == "SOCKET" and i.in_out == "OUTPUT" for i in ng.interface.items_tree):
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    rl.scene = sc
    gl = ng.nodes.new("CompositorNodeGlare")
    for ident, val in (("Type", "Bloom"), ("Quality", "High"), ("Highlights Threshold", 0.9),
                       ("Strength", 0.9), ("Size", 0.6)):
        try:
            sock(gl, ident).default_value = val
        except (StopIteration, TypeError, ValueError):
            pass
    out = ng.nodes.new("NodeGroupOutput")
    ng.links.new(rl.outputs[0], gl.inputs[0])
    ng.links.new(gl.outputs[0], out.inputs[0])
    sc.compositing_node_group = ng


def setup_preview_rig(sc, coll):
    def area(name, loc, energy, size, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy, ld.size, ld.color = energy, size, color
        ob = bpy.data.objects.new(name, ld)
        coll.objects.link(ob)
        ob.location = loc
        d = Vector((0, 0, 1.2)) - Vector(loc)
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

    # lit from every side because the site rotates the model
    area("AW_Key", (3.0, -3.5, 8.5), 650, 4, (0.92, 0.95, 1.0))
    area("AW_Front", (-1.5, -8.0, 3.0), 380, 6, (0.88, 0.92, 1.0))
    area("AW_Left", (-8.0, 1.0, 4.0), 380, 6, (0.88, 0.92, 1.0))
    area("AW_Right", (8.0, 1.0, 4.0), 300, 6, (0.88, 0.92, 1.0))
    area("AW_Back", (0.0, 8.0, 4.5), 420, 6, (0.9, 0.93, 1.0))

    cd = bpy.data.cameras.new("AW_PreviewCam")
    cd.lens = 50
    cam = bpy.data.objects.new("AW_PreviewCam", cd)
    coll.objects.link(cam)
    cam.location = (8.6, -9.4, 7.6)
    cam.rotation_euler = (Vector((0, 0, 1.25)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam


# ---------------------------------------------------------------- mesh helpers

def _box(t, x0, x1, y0, y1, z0, z1, mat):
    co = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
          (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    v = [t.verts.new(c) for c in co]
    for idx in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        t.faces.new([v[i] for i in idx]).material_index = mat


def _cut(t, co, no):
    bmesh.ops.bisect_plane(t, geom=t.verts[:] + t.edges[:] + t.faces[:], dist=1e-6,
                           plane_co=co, plane_no=no)


def _bevel(t, edges, offset, segs):
    if not edges:
        return
    try:
        bmesh.ops.bevel(t, geom=edges, offset=offset, offset_type="OFFSET", segments=segs,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
    except TypeError:
        bmesh.ops.bevel(t, geom=edges, offset=offset, segments=segs, profile=0.5,
                        vertex_only=False, clamp_overlap=True)


def _inset(t, faces, thick, depth, mat):
    if not faces:
        return
    bmesh.ops.inset_individual(t, faces=faces, thickness=thick, depth=depth, use_even_offset=True)
    if mat is not None:
        for f in faces:
            f.material_index = mat


def merge(dst, src, uv=False):
    vmap = {v: dst.verts.new(v.co) for v in src.verts}
    uv_s = src.loops.layers.uv.active if uv else None
    uv_d = (dst.loops.layers.uv.active or dst.loops.layers.uv.new("UVMap")) if uv_s else None
    for f in src.faces:
        try:
            nf = dst.faces.new([vmap[v] for v in f.verts])
        except ValueError:
            continue
        nf.material_index = f.material_index
        if uv_s:
            for ln, lo in zip(nf.loops, f.loops):
                ln[uv_d].uv = lo[uv_s].uv


def block(bm, x0, x1, y0, y1, z0, z1, mat=BODY, bevel=0.012, segs=1,
          top=(0.035, -0.006), top_mat=RECESS, side=(0.028, -0.006), side_mat=BODY,
          xcuts=(), ycuts=(), zcuts=()):
    """Bevelled slab with optional panel tiling (cut lines) and recessed panels.

    top / side are (inset, depth) pairs for the top face and the vertical faces;
    cut lines split those faces into tiles that are each recessed on their own.
    """
    t = bmesh.new()
    _box(t, x0, x1, y0, y1, z0, z1, mat)
    for x in xcuts:
        if x0 < x < x1:
            _cut(t, (x, 0, 0), (1, 0, 0))
    for y in ycuts:
        if y0 < y < y1:
            _cut(t, (0, y, 0), (0, 1, 0))
    for z in zcuts:
        if z0 < z < z1:
            _cut(t, (0, 0, z), (0, 0, 1))
    t.normal_update()
    if bevel:
        edges = [e for e in t.edges if len(e.link_faces) == 2
                 and e.link_faces[0].normal.dot(e.link_faces[1].normal) < 0.5]
        _bevel(t, edges, bevel, segs)
        t.normal_update()
    if top:
        tops = [f for f in t.faces if f.normal.z > 0.999
                and abs(f.calc_center_median().z - z1) < 1e-4]
        _inset(t, tops, top[0], top[1], top_mat)
    if side:
        sides = [f for f in t.faces if abs(f.normal.z) < 1e-3
                 and max(abs(f.normal.x), abs(f.normal.y)) > 0.999]
        _inset(t, sides, side[0], side[1], side_mat)
    merge(bm, t)
    t.free()


def strip(bm, x0, x1, y0, y1, z0, z1, mat=ACCENT):
    """Plain box, used for glow strips, trench lines and small hard parts."""
    t = bmesh.new()
    _box(t, x0, x1, y0, y1, z0, z1, mat)
    merge(bm, t)
    t.free()


def cylinder(bm, cx, cy, z0, z1, r, segs=16, mat=BODY, top=None, top_mat=RECESS):
    t = bmesh.new()
    m = Matrix.Translation((cx, cy, (z0 + z1) / 2))
    try:
        bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=segs,
                              radius1=r, radius2=r, depth=z1 - z0, matrix=m)
    except TypeError:
        bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=segs,
                              diameter1=r, diameter2=r, depth=z1 - z0, matrix=m)
    for f in t.faces:
        f.material_index = mat
    if top:
        t.normal_update()
        tf = [f for f in t.faces if f.normal.z > 0.99]
        bmesh.ops.inset_region(t, faces=tf, thickness=top[0], depth=top[1])
        for f in tf:
            f.material_index = top_mat
    merge(bm, t)
    t.free()


def transformed(build_fn, matrix):
    """Run build_fn(tmp_bmesh), transform the result, return the temp bmesh."""
    t = bmesh.new()
    build_fn(t)
    bmesh.ops.transform(t, matrix=matrix, verts=t.verts)
    return t


def put(bm, build_fn, matrix, uv=False):
    t = transformed(build_fn, matrix)
    merge(bm, t, uv=uv)
    t.free()


def sweep(bm, pts, w, h, normal, closed=False, mat=ACCENT):
    """Rectangular-section ribbon along a polyline: w wide in the plane whose
    normal is given, h thick along that normal. Used for frames, icons, handles."""
    n = Vector(normal).normalized()
    P = [Vector(p) for p in pts]
    N = len(P)
    rings = []
    for i in range(N):
        if closed:
            a, b = P[i] - P[i - 1], P[(i + 1) % N] - P[i]
        else:
            a = P[i] - P[i - 1] if i > 0 else P[1] - P[0]
            b = P[i + 1] - P[i] if i < N - 1 else P[i] - P[i - 1]
        a.normalize()
        b.normalize()
        tan = a + b
        tan = tan.normalized() if tan.length > 1e-6 else b
        side = n.cross(tan).normalized()
        s = side * ((w / 2) / max(0.3, tan.dot(b)))
        d = n * (h / 2)
        rings.append([bm.verts.new(P[i] + s + d), bm.verts.new(P[i] - s + d),
                      bm.verts.new(P[i] - s - d), bm.verts.new(P[i] + s - d)])
    new = []
    for i in (range(N) if closed else range(N - 1)):
        r0, r1 = rings[i], rings[(i + 1) % N]
        for k in range(4):
            new.append(bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k])))
    if not closed:
        new.append(bm.faces.new(rings[0][::-1]))
        new.append(bm.faces.new(rings[-1]))
    for f in new:
        f.material_index = mat
    bmesh.ops.recalc_face_normals(bm, faces=new)


def arc(cx, cz, rx, rz, a0, a1, n, y=0.0):
    """Points on an ellipse arc in the XZ plane (angles in degrees)."""
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)), y,
             cz + rz * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


# ---------------------------------------------------------------- builders

class Builder:
    def __init__(self, name, parent, props):
        self.name, self.parent, self.props = name, parent, props or {}
        self.bm = bmesh.new()


BUILDERS = {}


def get(name, parent=ROOT_NAME, **props):
    b = BUILDERS.get(name)
    if b is None:
        b = BUILDERS[name] = Builder(name, parent, props)
    return b.bm


def realize(coll):
    root = bpy.data.objects.new(ROOT_NAME, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.5
    coll.objects.link(root)
    root["role"] = "root"
    root["accent_material"] = "MAT_Accent_Emissive"
    objs, world_pos = {ROOT_NAME: root}, {ROOT_NAME: Vector()}
    mats = [bpy.data.materials[n] for n in MAT_NAMES]

    for name, b in BUILDERS.items():
        if not b.bm.faces:
            b.bm.free()
            continue
        me = bpy.data.meshes.new(name)
        b.bm.to_mesh(me)
        b.bm.free()

        xs = [v.co for v in me.vertices]
        lo = Vector((min(c.x for c in xs), min(c.y for c in xs), min(c.z for c in xs)))
        hi = Vector((max(c.x for c in xs), max(c.y for c in xs)))
        c = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        me.transform(Matrix.Translation(-c))

        used = sorted({p.material_index for p in me.polygons})
        for i in used:
            me.materials.append(mats[i])
        remap = {old: new for new, old in enumerate(used)}
        me.polygons.foreach_set("material_index", [remap[p.material_index] for p in me.polygons])
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        me.set_sharp_from_angle(angle=math.radians(35))

        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        ob.parent = objs[b.parent]
        ob.location = c - world_pos[b.parent]
        for k, v in b.props.items():
            ob[k] = v
        objs[name], world_pos[name] = ob, c
    BUILDERS.clear()
    return objs


# ---------------------------------------------------------------- step 1: base

def step_base():
    bm = get("BASE_Static", role="static")
    side = (0.03, -0.006)

    # recessed plinth under everything, so lifted platforms reveal a floor
    block(bm, -1.97, 1.97, -1.97, 1.97, 0.0, Z0, mat=RECESS, bevel=0.008, top=None, side=None)

    # front-corner fillers either side of DEPLOYMENT / GROWTH
    block(bm, -2.0, -1.51, -1.92, -1.05, Z0, 0.42, ycuts=(-1.48,), zcuts=(0.24,), side=side)
    block(bm, 1.55, 2.0, -1.9, -1.05, Z0, 0.40, ycuts=(-1.48,), zcuts=(0.23,), side=side)

    # side blocks beside the desk platform
    block(bm, -2.0, -1.25, -0.15, 1.35, Z0, 0.98, xcuts=(-1.62,), ycuts=(0.4, 0.9),
          zcuts=(0.36, 0.68), side=side)
    block(bm, 1.25, 2.0, -0.15, 1.35, Z0, 0.92, xcuts=(1.62,), ycuts=(0.45, 0.95),
          zcuts=(0.34, 0.64), side=side)

    # back row the towers stand on
    block(bm, -2.0, -0.95, 1.4, 2.0, Z0, 1.00, xcuts=(-1.45,), zcuts=(0.38, 0.7), side=side)
    block(bm, -0.9, 0.2, 1.4, 2.0, Z0, 1.22, xcuts=(-0.35,), zcuts=(0.42, 0.84), side=side)
    block(bm, 0.25, 1.15, 1.4, 2.0, Z0, 1.12, xcuts=(0.7,), zcuts=(0.4, 0.78), side=side)
    block(bm, 1.2, 2.0, 1.4, 2.0, Z0, 0.95, xcuts=(1.6,), zcuts=(0.36, 0.66), side=side)

    # pedestal under PLT_Desk, inset so the platform overhangs it
    block(bm, -1.1, 1.1, -0.05, 1.28, Z0, DESK_Z0, mat=RECESS, top=None,
          xcuts=(-0.55, 0.0, 0.55), zcuts=(0.6,), side=(0.03, -0.01), side_mat=RECESS)

    # courtyard floor in front of the desk, between ARCHITECTURE and DEVELOPMENT
    block(bm, -0.75, 0.73, -1.0, -0.08, Z0, 0.80, xcuts=(0.0,), ycuts=(-0.55,),
          zcuts=(0.43,), side=side)

    # cube pedestal and the L-shaped conduit on the courtyard
    block(bm, 0.12, 0.66, -0.85, -0.31, 0.80, 0.88, bevel=0.01, side=None)
    block(bm, -0.75, -0.28, -0.52, -0.36, 0.80, 0.96, bevel=0.01, side=None)
    block(bm, -0.44, -0.28, -0.95, -0.52, 0.80, 0.96, bevel=0.01, side=None)


# ---------------------------------------------------------------- text

_FONT = None


def font():
    global _FONT
    if _FONT is None:
        _FONT = bpy.data.fonts.load(FONT_PATH, check_existing=True)
    return _FONT


def text_bm(body, size, spacing=1.25):
    """Flat text mesh in the XY plane, facing +Z, left end of baseline at origin."""
    cu = bpy.data.curves.new("_txt", "FONT")
    cu.body = body
    cu.font = font()
    cu.size = size
    cu.space_character = spacing
    cu.resolution_u = 3
    cu.extrude = 0.0
    ob = bpy.data.objects.new("_txt", cu)
    sc = bpy.data.scenes[SCENE_NAME]
    sc.collection.objects.link(ob)
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
    return t


def place_text(bm, body, size, matrix, mat=LABEL, spacing=1.25):
    """Text rotated upright (+Z normal -> -Y) and moved by matrix. Returns its width."""
    t = text_bm(body, size, spacing)
    width = max((v.co.x for v in t.verts), default=0.0)
    for f in t.faces:
        f.material_index = mat
    bmesh.ops.transform(t, matrix=matrix @ Matrix.Rotation(math.radians(90), 4, "X"), verts=t.verts)
    merge(bm, t)
    t.free()
    return width


# ---------------------------------------------------------------- step 2: platforms

# name: footprint (x0, x1, y0, y1), top z, label, label x / baseline z, front-face
# cut lines (kept clear of the label), and node boxes (cx, cy, sx, sy, h).
PLATFORMS = {
    "PLT_Architecture": dict(box=(-2.0, -0.8, -1.0, -0.2), top=1.12, label="ARCHITECTURE",
                             lx=-1.86, lz=0.95, xcuts=(-1.1,), ycuts=(-0.6,), zcuts=(0.78,),
                             nodes=[(-1.02, -0.46, 0.15, 0.15, 0.17)]),
    "PLT_Development": dict(box=(0.78, 2.0, -1.0, -0.2), top=1.06, label="DEVELOPMENT",
                            lx=0.97, lz=0.89, xcuts=(1.7,), ycuts=(-0.6,), zcuts=(0.72,),
                            nodes=[(1.08, -0.5, 0.16, 0.16, 0.22), (1.76, -0.38, 0.11, 0.11, 0.12)]),
    "PLT_Deployment": dict(box=(-1.46, -0.03, -2.0, -1.05), top=0.64, label="DEPLOYMENT",
                           lx=-1.3, lz=0.49, xcuts=(-0.6,), ycuts=(-1.52,), zcuts=(0.33,),
                           nodes=[(-0.4, -1.32, 0.14, 0.14, 0.16), (-1.18, -1.24, 0.1, 0.18, 0.1)]),
    "PLT_Growth": dict(box=(0.03, 1.5, -2.0, -1.05), top=0.56, label="GROWTH",
                       lx=0.19, lz=0.42, xcuts=(0.8,), ycuts=(-1.52,), zcuts=(0.28,),
                       nodes=[(1.2, -1.28, 0.14, 0.14, 0.2)]),
}
SIDE_DEPTH = 0.006   # recess of side panels; labels sit just proud of it


def node_box(bm, cx, cy, sx, sy, z0, h):
    """Small node box whose recessed top glows."""
    block(bm, cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, z0, z0 + h, bevel=0.008,
          top=(0.022, -0.006), top_mat=ACCENT, side=None)


def step_platforms():
    for name, p in PLATFORMS.items():
        x0, x1, y0, y1 = p["box"]
        z1 = p["top"]
        word = p["label"].title()
        bm = get(name, role="platform", label=p["label"])
        block(bm, x0, x1, y0, y1, Z0, z1, bevel=0.014, top=(0.035, -0.006),
              side=(0.03, -SIDE_DEPTH), xcuts=p["xcuts"], ycuts=p["ycuts"], zcuts=p["zcuts"])

        # engraved label on the front face, with a short glowing dash under it
        lab = get(f"LABEL_{word}", parent=name, role="label")
        yf = y0 + SIDE_DEPTH - 0.0015
        width = place_text(lab, p["label"], 0.1, Matrix.Translation((p["lx"], yf, p["lz"])))
        dash = get(f"DASH_{word}", parent=name, role="accent")
        strip(dash, p["lx"], p["lx"] + 0.12, yf - 0.003, yf, p["lz"] - 0.058, p["lz"] - 0.044)
        p["label_width"] = width

        for i, (cx, cy, sx, sy, h) in enumerate(p["nodes"], 1):
            node_box(get(f"NODE_{word}_{i:02d}", parent=name, role="node"), cx, cy, sx, sy, z1, h)


# ---------------------------------------------------------------- step 3: desk

# The monitor is two halves meeting at a seam, each turned toward the chair.
# The lit area of each half is LIT_W x LIT_H; make-about-screen.py draws the
# texture at exactly that aspect (both halves side by side).
SCREEN_YM = 0.88               # y of the seam
SCREEN_ZB = DZT + 0.12         # bottom of the monitor bodies
HALF_W, SCREEN_H = 0.655, 0.48
LIT_X0, LIT_W, LIT_H, LIT_Z0 = 0.004, 0.639, 0.456, 0.012
SCREEN_TILT = 7.0              # degrees each half is turned


# The desk set (table, monitor, keyboard, mouse, mug, chair) is modelled at the
# sizes below and then scaled up about the platform's centre, standing on its
# top, so it reads as the hero the way it does in the references.
DESK_SCALE = 1.15
DESK_M = Matrix.Translation((0, 0.6, DZ)) @ Matrix.Scale(DESK_SCALE, 4) @ \
    Matrix.Translation((0, -0.6, -DZ))


def screen_matrix(s):
    """Half-local -> world; s = -1 for the left half, +1 for the right."""
    return DESK_M @ Matrix.Translation((0, SCREEN_YM, 0)) @ \
        Matrix.Rotation(math.radians(-s * SCREEN_TILT), 4, "Z")


def monitor_half(t, s):
    def sx(a, b):
        return sorted((s * a, s * b))

    block(t, *sx(0.0, HALF_W), 0.0, 0.028, SCREEN_ZB, SCREEN_ZB + SCREEN_H,
          bevel=0.006, top=None, side=None)
    block(t, *sx(0.15, 0.5), 0.028, 0.058, SCREEN_ZB + 0.08, SCREEN_ZB + 0.38,
          bevel=0.01, top=None, side=None)
    block(t, *sx(0.30, 0.35), 0.058, 0.082, DZT + 0.01, SCREEN_ZB + 0.26,
          bevel=0.005, top=None, side=None)
    block(t, *sx(0.23, 0.42), -0.03, 0.14, DZT, DZT + 0.012, bevel=0.004, top=None, side=None)

    uv = t.loops.layers.uv.active or t.loops.layers.uv.new("UVMap")
    la, lb = sx(LIT_X0, LIT_X0 + LIT_W)
    z0, z1 = SCREEN_ZB + LIT_Z0, SCREEN_ZB + LIT_Z0 + LIT_H
    vs = [t.verts.new(c) for c in ((la, -0.0012, z0), (lb, -0.0012, z0),
                                   (lb, -0.0012, z1), (la, -0.0012, z1))]
    f = t.faces.new(vs)
    f.material_index = SCREEN
    u0, u1 = (0.0, 0.5) if s < 0 else (0.5, 1.0)
    for loop, co in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))):
        loop[uv].uv = co


def chair(t):
    """Gaming chair facing +Y, built around its own origin on the floor."""
    for k in range(5):
        a = math.radians(90 + k * 72)
        put(t, lambda b: block(b, 0.0, 0.15, -0.011, 0.011, 0.035, 0.055, bevel=0.004,
                               top=None, side=None), Matrix.Rotation(a, 4, "Z"))
        cylinder(t, 0.15 * math.cos(a), 0.15 * math.sin(a), 0.0, 0.03, 0.016, segs=8, mat=RECESS)
    cylinder(t, 0, 0, 0.03, 0.06, 0.03, segs=12)
    cylinder(t, 0, 0, 0.06, 0.2, 0.013, segs=10, mat=RECESS)

    block(t, -0.13, 0.13, -0.11, 0.14, 0.2, 0.245, bevel=0.014, segs=2, top=None, side=None)
    for s in (-1, 1):
        def sx(a, b):
            return sorted((s * a, s * b))
        block(t, *sx(0.1, 0.138), -0.11, 0.14, 0.235, 0.262, bevel=0.01, segs=2, top=None, side=None)
        block(t, *sx(0.148, 0.165), -0.03, 0.01, 0.22, 0.33, bevel=0.004, top=None, side=None)
        block(t, *sx(0.138, 0.175), -0.08, 0.07, 0.33, 0.345, bevel=0.006, top=None, side=None)

    def back(b):
        block(b, -0.125, 0.125, -0.028, 0.02, 0.0, 0.31, bevel=0.016, segs=2, top=None, side=None)
        for s in (-1, 1):
            xa, xb = sorted((s * 0.095, s * 0.135))
            block(b, xa, xb, -0.03, 0.048, 0.02, 0.29, bevel=0.012, segs=2, top=None, side=None)
            pa, pb = sorted((s * 0.108, s * 0.116))
            strip(b, pa, pb, -0.035, -0.029, 0.04, 0.27)          # accent piping
        block(b, -0.07, 0.07, -0.02, 0.015, 0.3, 0.335, bevel=0.008, top=None, side=None)
        block(b, -0.095, 0.095, -0.026, 0.02, 0.33, 0.44, bevel=0.018, segs=2, top=None, side=None)

    # upright at the seat's back edge, then reclined 10 degrees
    put(t, back, Matrix.Translation((0, -0.1, 0.23)) @ Matrix.Rotation(math.radians(10), 4, "X"))


DESK_NODES = [(-1.05, 1.15, 0.14, 0.14, 0.34), (1.0, 0.62, 0.16, 0.14, 0.44),
              (1.07, -0.04, 0.12, 0.12, 0.18)]


def step_desk():
    P = "PLT_Desk"
    bm = get(P, role="platform", label="DESK")
    block(bm, -1.2, 1.2, -0.15, 1.35, DESK_Z0, DZ, bevel=0.014, top=(0.035, -0.004),
          side=(0.03, -SIDE_DEPTH), xcuts=(-0.4, 0.4), ycuts=(0.6,))

    def table(d):
        block(d, -0.74, 0.74, 0.5, 1.02, DZ + 0.305, DZT, bevel=0.008, top=None, side=None)
        for xa, xb in ((-0.72, -0.67), (0.67, 0.72)):
            block(d, xa, xb, 0.54, 0.98, DZ, DZ + 0.305, bevel=0.006, top=None,
                  side=(0.012, -0.004))
        block(d, -0.67, 0.67, 0.93, 0.96, DZ + 0.1, DZ + 0.305, bevel=0.004, top=None, side=None)
        strip(d, -0.44, 0.48, 0.56, 0.8, DZT, DZT + 0.004, mat=RECESS)      # desk mat

    def keyboard(k):
        block(k, -0.21, 0.19, 0.6, 0.72, DZT + 0.004, DZT + 0.016, bevel=0.004,
              top=(0.008, -0.003), side=None)
        for row in range(4):
            y = 0.611 + row * 0.0255
            cols = [(c, c) for c in range(14)] if row else \
                [(0, 0), (1, 1), (2, 2), (3, 10), (11, 11), (12, 12), (13, 13)]
            for ca, cb in cols:
                x = -0.198 + ca * 0.0268
                strip(k, x, x + 0.022 + (cb - ca) * 0.0268, y, y + 0.02, DZT + 0.013,
                      DZT + 0.02, mat=BODY)

    def mouse(m):
        block(m, 0.31, 0.355, 0.62, 0.69, DZT + 0.004, DZT + 0.022, bevel=0.008, segs=2,
              top=None, side=None)

    def mug(t):
        cylinder(t, -0.56, 0.7, DZT, DZT + 0.085, 0.038, segs=20, mat=ACCENT, top=(0.005, -0.012))
        sweep(t, [(x, 0.7 + y, z) for x, y, z in arc(-0.598, DZT + 0.044, 0.022, 0.024, 90, 270, 8)],
              0.01, 0.012, (0, 1, 0))

    put(get("DESK_Table", parent=P, role="prop"), table, DESK_M)
    put(get("DESK_Keyboard", parent=P, role="prop"), keyboard, DESK_M)
    put(get("DESK_Mouse", parent=P, role="prop"), mouse, DESK_M)
    put(get("DESK_Mug", parent=P, role="prop"), mug, DESK_M)
    put(get("DESK_Chair", parent=P, role="prop"), chair,
        DESK_M @ Matrix.Translation((0.02, 0.3, DZ)) @ Matrix.Rotation(math.radians(-12), 4, "Z"))

    scr = get("SCREEN_Main", parent=P, role="screen")
    for s in (-1, 1):
        put(scr, lambda t, s=s: monitor_half(t, s), screen_matrix(s), uv=True)

    for i, (cx, cy, sx, sy, h) in enumerate(DESK_NODES, 1):
        node_box(get(f"NODE_Desk_{i:02d}", parent=P, role="node"), cx, cy, sx, sy, DZ, h)


# ---------------------------------------------------------------- step 4: towers

# name, centre x/y, size x/y, base z (top of what it stands on), height,
# beacon on top, antenna, and front-face indicator slits.
TOWERS = [
    ("TOWER_01", -1.62, 1.68, 0.44, 0.44, 1.00, 1.60, True, False, 1),
    ("TOWER_02", -1.12, 1.80, 0.24, 0.26, 1.00, 1.15, True, True, 0),
    ("TOWER_03", -0.42, 1.72, 0.56, 0.42, 1.22, 0.55, False, False, 3),
    ("TOWER_04", 0.62, 1.70, 0.50, 0.50, 1.12, 1.85, True, True, 1),
    ("TOWER_05", 1.35, 1.80, 0.28, 0.28, 0.95, 1.35, True, False, 0),
    ("TOWER_06", 1.78, 1.52, 0.34, 0.34, 0.95, 1.55, True, True, 1),
    ("TOWER_07", -1.62, 0.88, 0.32, 0.32, 0.98, 0.80, True, False, 1),
    ("TOWER_08", -1.75, 0.20, 0.22, 0.26, 0.98, 0.42, True, False, 0),
    ("TOWER_09", 1.65, 0.92, 0.36, 0.36, 0.92, 1.05, True, False, 1),
    ("TOWER_10", 1.66, 0.22, 0.22, 0.22, 0.92, 0.38, True, False, 0),
    ("TOWER_11", -1.76, -1.62, 0.24, 0.24, 0.42, 0.55, True, False, 0),
    ("TOWER_12", 1.78, -1.48, 0.24, 0.24, 0.40, 0.32, True, False, 0),
]


def step_towers():
    for name, cx, cy, sx, sy, z0, h, *_ in TOWERS:
        bm = get(name, role="tower")
        n = max(1, round(h / 0.42))
        zc = [z0 + h * i / n for i in range(1, n)]
        xc = (cx,) if sx > 0.4 else ()
        block(bm, cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, z0, z0 + h,
              bevel=0.012, top=(0.03, -0.008), side=(0.022, -0.006), zcuts=zc, xcuts=xc)


# ---------------------------------------------------------------- step 5: glass panels

PANEL_FOOT = 0.035     # height of the dark foot rail each sheet stands in
TXT_Y = -0.004         # panel text / icons sit just in front of the glass


def rrect(cx, w, h, r, z0, segs=4):
    """Rounded rectangle in the XZ plane, counter-clockwise seen from -Y."""
    pts = []
    for (ox, oz), a0 in (((cx + w / 2 - r, z0 + r), -90), ((cx + w / 2 - r, z0 + h - r), 0),
                         ((cx - w / 2 + r, z0 + h - r), 90), ((cx - w / 2 + r, z0 + r), 180)):
        for i in range(segs + 1):
            a = math.radians(a0 + 90 * i / segs)
            pts.append((ox + r * math.cos(a), oz + r * math.sin(a)))
    return pts


def glass_sheet(t, w, h, x=0.0, y=0.0, r=0.05):
    """Glass sheet facing -Y with a glowing frame, standing in a dark foot rail."""
    pts = rrect(x, w, h, r, PANEL_FOOT)
    t.faces.new([t.verts.new((px, y, pz)) for px, pz in pts]).material_index = GLASS
    sweep(t, [(px, y, pz) for px, pz in pts], 0.012, 0.012, (0, 1, 0), closed=True)
    block(t, x - w / 2 + 0.03, x + w / 2 - 0.03, y - 0.025, y + 0.025, 0.0, PANEL_FOOT,
          bevel=0.006, top=None, side=None)


def icon_stroke(t, pts, closed=False):
    sweep(t, pts, 0.0045, 0.003, (0, 1, 0), closed=closed)


def icon_globe(t, cx, cz, R=0.03):
    y = TXT_Y - 0.001
    icon_stroke(t, arc(cx, cz, R, R, 0, 360, 20, y)[:-1], closed=True)
    icon_stroke(t, arc(cx, cz, R * 0.42, R, 0, 360, 16, y)[:-1], closed=True)
    icon_stroke(t, [(cx - R, y, cz), (cx + R, y, cz)])
    for dz in (-0.5, 0.5):
        hw = R * math.sqrt(1 - dz * dz) * 0.95
        icon_stroke(t, [(cx - hw, y, cz + dz * R), (cx + hw, y, cz + dz * R)])


def icon_database(t, cx, cz, rx=0.028, rz=0.009, hh=0.021):
    y = TXT_Y - 0.001
    icon_stroke(t, arc(cx, cz + hh, rx, rz, 0, 360, 18, y)[:-1], closed=True)
    for zc in (cz, cz - hh):
        icon_stroke(t, arc(cx, zc, rx, rz, 180, 360, 9, y))
    for sx in (-1, 1):
        icon_stroke(t, [(cx + sx * rx, y, cz + hh), (cx + sx * rx, y, cz - hh)])


def icon_people(t, cx, cz):
    y = TXT_Y - 0.001
    icon_stroke(t, arc(cx - 0.011, cz + 0.011, 0.0095, 0.0095, 0, 360, 14, y)[:-1], closed=True)
    icon_stroke(t, arc(cx + 0.014, cz + 0.016, 0.008, 0.008, 0, 360, 14, y)[:-1], closed=True)
    icon_stroke(t, arc(cx - 0.011, cz - 0.022, 0.02, 0.019, 5, 175, 10, y))
    icon_stroke(t, arc(cx + 0.016, cz - 0.011, 0.016, 0.014, 15, 165, 8, y))


def bullet(t, cx, cz, r=0.009):
    y = TXT_Y - 0.001
    t.faces.new([t.verts.new(p) for p in arc(cx, cz, r, r, 0, 360, 12, y)[:-1]]).material_index = ACCENT


PANEL_LEFT = dict(centre=(-0.98, 0.18), angle=45, w=0.62, h=0.92)
PANEL_RIGHT = dict(centre=(0.92, 0.98), angle=-25, w=0.60, h=0.86)


def panel_left(t):
    w, h = PANEL_LEFT["w"], PANEL_LEFT["h"]
    glass_sheet(t, w, h)
    for frac, word, icon in ((0.74, "WEB APPS", icon_globe), (0.5, "SYSTEMS", icon_database),
                             (0.26, "TEAMS", icon_people)):
        zc = PANEL_FOOT + h * frac
        icon(t, -0.2, zc)
        place_text(t, word, 0.05, Matrix.Translation((-0.13, TXT_Y, zc - 0.018)))


def panel_right(t):
    w, h = PANEL_RIGHT["w"], PANEL_RIGHT["h"]
    glass_sheet(t, w, h)
    for frac, word in ((0.72, "SCALABLE"), (0.52, "PERFORMANT"), (0.32, "USER FOCUSED")):
        zc = PANEL_FOOT + h * frac
        bullet(t, -0.215, zc)
        place_text(t, word, 0.042, Matrix.Translation((-0.18, TXT_Y, zc - 0.015)))
    zd = PANEL_FOOT + h * 0.2
    strip(t, -0.215, -0.115, TXT_Y - 0.003, TXT_Y, zd, zd + 0.012)


def panel_center(t):
    glass_sheet(t, 1.9, 1.05, y=0.0)
    glass_sheet(t, 1.0, 1.38, x=0.22, y=0.09)


def step_panels():
    P = "PLT_Desk"
    for name, fn, spec in (("PANEL_Left", panel_left, PANEL_LEFT),
                           ("PANEL_Right", panel_right, PANEL_RIGHT),
                           ("PANEL_Center", panel_center, dict(centre=(0.0, 1.2), angle=0))):
        bm = get(name, parent=P, role="panel")
        cx, cy = spec["centre"]
        put(bm, fn, Matrix.Translation((cx, cy, DZ)) @
            Matrix.Rotation(math.radians(spec["angle"]), 4, "Z"))


# ---------------------------------------------------------------- step 6: cube

CUBE = dict(cx=0.39, cy=-0.58, size=0.44, z0=0.88, edge=0.014)


def step_cube():
    bm = get("CUBE_Core", role="cube")
    cx, cy, s, z0, e = CUBE["cx"], CUBE["cy"], CUBE["size"], CUBE["z0"], CUBE["edge"]
    h = s / 2
    _box(bm, cx - h + e / 2, cx + h - e / 2, cy - h + e / 2, cy + h - e / 2,
         z0 + e / 2, z0 + s - e / 2, GLASS)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = cx + sx * (h - e / 2), cy + sy * (h - e / 2)
            strip(bm, x - e / 2, x + e / 2, y - e / 2, y + e / 2, z0, z0 + s)
    for z in (z0, z0 + s - e):
        for sy in (-1, 1):
            y = cy + sy * (h - e / 2)
            strip(bm, cx - h + e, cx + h - e, y - e / 2, y + e / 2, z, z + e)
        for sx in (-1, 1):
            x = cx + sx * (h - e / 2)
            strip(bm, x - e / 2, x + e / 2, cy - h + e, cy + h - e, z, z + e)


# ---------------------------------------------------------------- step 7: glow

def step_glow():
    base = get("BASE_Static")
    st = lambda *a: strip(base, *a)          # noqa: E731

    # underglow on the desk pedestal, just below PLT_Desk
    st(-1.1, 1.1, -0.054, -0.05, 1.105, 1.12)
    st(-1.104, -1.1, -0.05, 1.28, 1.105, 1.12)
    st(1.1, 1.104, -0.05, 1.28, 1.105, 1.12)

    # trench lines: desk -> courtyard -> between the front platforms, plus branches
    ct = 0.8
    st(-0.015, 0.015, -1.0, -0.08, ct - 0.003, ct + 0.003)
    st(-0.015, 0.015, -1.004, -0.998, Z0, ct)
    st(-0.015, 0.015, -2.0, -1.0, Z0, Z0 + 0.006)
    st(-2.0, 2.0, -1.035, -1.015, Z0, Z0 + 0.006)
    st(-1.495, -1.475, -2.0, -1.05, Z0, Z0 + 0.006)
    st(1.515, 1.535, -2.0, -1.05, Z0, Z0 + 0.006)
    st(0.0, 0.405, -0.215, -0.185, ct - 0.003, ct + 0.003)
    st(0.375, 0.405, -0.31, -0.185, ct - 0.003, ct + 0.003)
    st(-0.28, 0.0, -0.765, -0.735, ct - 0.003, ct + 0.003)

    # conduit: glowing channel in its top and a glowing end cap
    st(-0.72, -0.35, -0.445, -0.435, 0.951, 0.956)
    st(-0.365, -0.355, -0.92, -0.435, 0.951, 0.956)
    st(-0.43, -0.29, -0.954, -0.95, 0.815, 0.945)
    node_box(base, -0.12, -0.9, 0.12, 0.12, ct, 0.14)

    # vertical seams at the courtyard's front corners
    st(-0.745, -0.73, -1.004, -0.998, Z0, ct)
    st(0.715, 0.73, -1.004, -0.998, Z0, ct)

    # outer faces: left / right side blocks, back row, front fillers
    st(-2.004, -2.0, 0.39, 0.41, Z0, 0.98)
    st(-2.004, -2.0, -0.12, 1.32, 0.672, 0.688)
    st(2.0, 2.004, 0.44, 0.46, Z0, 0.92)
    st(2.0, 2.004, -0.12, 1.32, 0.632, 0.648)
    st(-1.95, -1.0, 2.0, 2.004, 0.692, 0.708)
    st(-0.85, 0.15, 2.0, 2.004, 0.832, 0.848)
    st(0.69, 0.71, 2.0, 2.004, Z0, 1.12)
    st(1.59, 1.61, 2.0, 2.004, Z0, 0.95)
    st(-1.98, -1.53, -1.924, -1.92, 0.232, 0.248)
    st(1.57, 1.98, -1.904, -1.9, 0.222, 0.238)

    # platform edge strips (they move with their platform)
    for name, p in PLATFORMS.items():
        x0, x1, y0, y1 = p["box"]
        z1 = p["top"]
        bm = get(name)
        if y0 < -1.5:                                        # front row: bottom glow
            strip(bm, x0 + 0.05, x1 - 0.05, y0 - 0.004, y0, Z0 + 0.016, Z0 + 0.028)
        else:                                                # mid row: inner top edge
            xi = x1 if x1 < 0 else x0 - 0.004
            strip(bm, xi, xi + 0.004, y0 + 0.05, y1 - 0.05, z1 - 0.05, z1 - 0.038)
            xo = x0 - 0.004 if x1 < 0 else x1
            strip(bm, xo, xo + 0.004, -0.62, -0.58, Z0, z1)
    g = get("PLT_Growth")
    strip(g, 1.5, 1.504, -1.95, -1.1, Z0 + 0.016, Z0 + 0.028)

    d = get("PLT_Desk")
    strip(d, -1.15, 1.15, -0.154, -0.15, DZ - 0.05, DZ - 0.038)
    strip(d, -1.204, -1.2, -0.1, 1.3, DZ - 0.05, DZ - 0.038)
    strip(d, 1.2, 1.204, -0.1, 1.3, DZ - 0.05, DZ - 0.038)
    put(get("DESK_Table"), lambda t: strip(t, -0.7, 0.7, 0.505, 0.52, DZ + 0.298, DZ + 0.305),
        DESK_M)
    strip(get("NODE_Desk_02"), 0.993, 1.007, 0.546, 0.55, DZ + 0.25, DZ + 0.33)

    # tower beacons, antennas and indicator slits
    for name, cx, cy, sx, sy, z0, h, beacon, antenna, slits in TOWERS:
        bm = get(name)
        z1 = z0 + h
        if beacon:
            b = min(sx, sy) * 0.4
            strip(bm, cx - b / 2, cx + b / 2, cy - b / 2, cy + b / 2, z1 - 0.008, z1 + 0.03)
        if antenna:
            ax = cx + sx * 0.3
            strip(bm, ax - 0.008, ax + 0.008, cy - 0.008, cy + 0.008, z1, z1 + 0.4, mat=BODY)
            strip(bm, ax - 0.014, ax + 0.014, cy - 0.014, cy + 0.014, z1 + 0.4, z1 + 0.428)
        yf = cy - sy / 2
        for k in range(slits):
            x = cx + (k - (slits - 1) / 2) * 0.05
            strip(bm, x - 0.007, x + 0.007, yf - 0.004, yf, z1 - 0.28, z1 - 0.22)


# ---------------------------------------------------------------- step 8: screen

def step_screen():
    """Accent marks over the monitor UI (texture itself is hooked in build())."""
    if not os.path.exists(SCREEN_JSON):
        return
    with open(SCREEN_JSON) as fh:
        spec = json.load(fh)
    assert abs(spec["lit_w"] - LIT_W) < 1e-6 and abs(spec["lit_h"] - LIT_H) < 1e-6, \
        "screen-ui.json is stale: re-run scripts/make-about-screen.py"
    scr = get("SCREEN_Main")
    for a in spec["accents"]:
        s = -1 if a["u1"] <= 0.5 else 1
        def ux(u, s=s):
            return -(LIT_X0 + LIT_W) + u * 2 * LIT_W if s < 0 else LIT_X0 + (u - 0.5) * 2 * LIT_W
        z0 = SCREEN_ZB + LIT_Z0 + a["v0"] * LIT_H
        z1 = SCREEN_ZB + LIT_Z0 + a["v1"] * LIT_H
        put(scr, lambda t, a=a, ux=ux, z0=z0, z1=z1: strip(t, ux(a["u0"]), ux(a["u1"]),
                                                            -0.004, -0.0015, z0, z1),
            screen_matrix(s), uv=True)


STEPS = [step_base, step_platforms, step_desk, step_towers, step_panels, step_cube, step_glow,
         step_screen]


# ---------------------------------------------------------------- viewport

VIEWS = {   # view_rotation euler (deg), perspective?, look-at z, distance
    "front": ((78, 0, 0), False, 1.55, 9.6),
    "left": ((78, 0, -90), False, 1.55, 9.6),
    "right": ((78, 0, 90), False, 1.55, 9.6),
    "back": ((78, 0, 180), False, 1.55, 9.6),
    "top": ((20, 0, 0), False, 1.0, 11.5),
    "persp": ((60, 0, 35), True, 1.3, 11.5),
}


def view(name):
    rot, persp, lz, dist = VIEWS[name]
    for area in bpy.context.window.screen.areas:
        if area.type != "VIEW_3D":
            continue
        sp = area.spaces.active
        sp.shading.type = "RENDERED"
        sp.shading.use_compositor = "ALWAYS"
        sp.overlay.show_overlays = False
        r = sp.region_3d
        r.view_perspective = "PERSP" if persp else "ORTHO"
        r.view_rotation = Euler([math.radians(a) for a in rot]).to_quaternion()
        r.view_location = (0, 0, lz)
        r.view_distance = dist


# ---------------------------------------------------------------- entry points

def build(upto=None):
    sc = get_scene()
    model = get_coll(sc, MODEL_COLL)
    preview = get_coll(sc, PREVIEW_COLL)
    for c in (model, preview):
        for ob in list(c.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
    for store in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras, bpy.data.curves):
        for d in list(store):
            if d.users == 0 and (d.name.startswith(("BASE_", "PLT_", "TOWER_", "PANEL_", "CUBE_",
                                                     "NODE_", "LABEL_", "DASH_", "DESK_", "SCREEN_",
                                                     "AW_", "_txt"))):
                store.remove(d)

    mats = make_materials()
    setup_world(sc)
    setup_render(sc)
    setup_preview_rig(sc, preview)
    BUILDERS.clear()
    steps = STEPS if upto is None else STEPS[:upto]
    for fn in steps:
        fn()
    if len(steps) == len(STEPS) or upto is None:
        hook_screen_texture(mats[SCREEN])
    objs = realize(model)
    return sc, objs


def export(path=GLB_OUT):
    """Export only AboutWorkspace (root + descendants) as a .glb, no preview rig."""
    sc = get_scene()
    root = bpy.data.objects[ROOT_NAME]
    keep = [root] + list(root.children_recursive)
    for ob in sc.objects:
        ob.select_set(ob in keep)
    bpy.context.view_layer.objects.active = root
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, use_active_scene=True,
        export_yup=True, export_apply=True, export_extras=True,
        export_materials="EXPORT", export_image_format="AUTO", export_texcoords=True,
        export_normals=True, export_tangents=False, export_animations=False,
        export_draco_mesh_compression_enable=False, export_lights=False, export_cameras=False)
    for ob in sc.objects:
        ob.select_set(False)
    return path, os.path.getsize(path)
