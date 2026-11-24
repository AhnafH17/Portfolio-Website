"""Build and bake the opening desk tour. Run blender -b -P scripts/build-desk-hero.py.

Local Blender coordinates are metres, with the front edge at Y=0 and the wall
in +Y. The glTF exporter converts this to Y-up with the visitor on +Z.
"""
from pathlib import Path
from math import cos, sin, pi, radians, atan2
import bpy
import numpy as np
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "assets/models-src/desk-hero.glb"
if not bpy.app.background or bpy.data.filepath:
    raise RuntimeError("Run in a new background Blender session.")
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def color(hexcode):
    s = [int(hexcode[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(n / 12.92 if n < .04045 else ((n + .055) / 1.055) ** 2.4 for n in s) + (1,)


def material(name, hexcode, roughness, metallic=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = color(hexcode)
    bs.inputs["Roughness"].default_value = roughness
    bs.inputs["Metallic"].default_value = metallic
    return m


laminate = material("MAT_Laminate", "39383b", .35)
coat = material("MAT_PowderCoat", "303135", .6, .28)
alloy = material("MAT_Anodised", "525357", .35, .8)
rubber = material("MAT_Rubber", "242426", .84)
cloth = material("MAT_Fleece", "414044", .95)
padcloth = material("MAT_PadCloth", "312f32", .95)
weave = material("MAT_ChairMesh", "48484a", .84)
keycap = material("MAT_Keycaps", "38373a", .53)
legend = material("MAT_KeyLegends", "a7a7a7", .7)
glass = material("MAT_SmokedGlass", "28292c", .16, .62)
window = material("MAT_TemperedGlass", "626469", .12, .45)
window.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = .25
screen = material("MAT_Screen", "161619", .46)
skin = material("MAT_Hand", "ac7b64", .64)
glow = material("MAT_Accent_Emissive", "cc182c", .4)
emitter = glow.node_tree.nodes.get("Principled BSDF")
emitter.inputs["Emission Color"].default_value = color("cc182c")
emitter.inputs["Emission Strength"].default_value = 4


def image_map(name, array, noncolor=True):
    h, w = array.shape[:2]
    im = bpy.data.images.new(name, w, h, alpha=True)
    if noncolor:
        im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(array.astype("float32").ravel())
    im.pack()
    return im


def image_node(m, im):
    n = m.node_tree.nodes.new("ShaderNodeTexImage")
    n.image = im
    return n


# Normal-map fibres form diagonal ribs. Keycap UVs use a polished central
# finger patch, with lower roughness on the home row and the space bar.
y, x = np.mgrid[:128, :128]
wave = np.sin(2 * pi * (x + y) / 8)
normal = np.stack([.5 + .11*wave, .5 + .09*wave, .99+0*x, 1+0*x], -1)
fabric = image_map("Fleece twill", normal)
for mat in (cloth, padcloth):
    nt = mat.node_tree
    n = nt.nodes.new("ShaderNodeNormalMap")
    n.inputs["Strength"].default_value = .34
    nt.links.new(image_node(mat, fabric).outputs["Color"], n.inputs["Color"])
    nt.links.new(n.outputs[0], nt.nodes.get("Principled BSDF").inputs["Normal"])
wear = .61 - .26*np.exp(-((x-64)**2 + (y-64)**2)/970)
im = image_map("Key polish", np.stack([wear, wear, wear, 1+0*x], -1))
keycap.node_tree.links.new(image_node(keycap, im).outputs[0],
                           keycap.node_tree.nodes.get("Principled BSDF").inputs["Roughness"])
# Woven chair insert, binary coverage. Exporter recognizes the threshold as MASK.
holes = ((x % 8 < 3) | ((y + (x//8) % 2) % 8 < 3)).astype(float)
im = image_map("Chair knit", np.stack([1+0*x, 1+0*x, 1+0*x, holes], -1), False)
nt = weave.node_tree
mask = nt.nodes.new("ShaderNodeMath")
mask.operation = "GREATER_THAN"
mask.inputs[1].default_value = .48
nt.links.new(image_node(weave, im).outputs["Alpha"], mask.inputs[0])
nt.links.new(mask.outputs[0], nt.nodes.get("Principled BSDF").inputs["Alpha"])


def group(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.parent, o.location = parent, loc
    return o


def finish(o, name, mat, parent):
    o.name, o.parent = name, parent
    o.data.materials.append(mat)
    return o


def box(name, xyz, dims, m, parent=None, bevel=.004, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    o = bpy.context.object
    for v in o.data.vertices:
        for axis in range(3):
            v.co[axis] *= dims[axis]
    if bevel:
        mod = o.modifiers.new("Machined edge", "BEVEL")
        mod.width, mod.segments = min(bevel, min(dims)*.48), segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = o.modifiers.new("Face normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, m, parent)


def ellipsoid(name, xyz, dims, m, parent, segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=xyz)
    o = bpy.context.object
    for v in o.data.vertices:
        for axis in range(3):
            v.co[axis] *= dims[axis]/2
    for f in o.data.polygons:
        f.use_smooth = True
    return finish(o, name, m, parent)


def rod(name, a, b, radius, m, parent, sides=16):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=(b-a).length, location=(a+b)/2)
    o = bpy.context.object
    o.rotation_euler = (b-a).to_track_quat("Z", "Y").to_euler()
    for f in o.data.polygons:
        f.use_smooth = len(f.vertices) == 4
    return finish(o, name, m, parent)


def tube(name, coords, r, m, parent, cyclic=False):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions, cu.resolution_u = "3D", 5 if name in ("Finger","Thumb") else 7
    cu.bevel_depth, cu.bevel_resolution = r, 1 if name in ("Finger","Thumb","Hood seam","Collar fold") else 2
    s = cu.splines.new("BEZIER")
    s.bezier_points.add(len(coords)-1)
    for p, v in zip(s.bezier_points, coords):
        p.co = v
        p.handle_left_type = p.handle_right_type = "AUTO"
    s.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return finish(o, name, m, parent)


def surface(name, coords, faces, m, parent, uvs=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(coords, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    for f in mesh.polygons:
        f.use_smooth = smooth
        if uvs:
            for idx in f.loop_indices:
                uv.data[idx].uv = uvs[mesh.loops[idx].vertex_index]
    o = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(o)
    return finish(o, name, m, parent)


def loft(name, rings, m, parent, n=24, folds=0):
    """Tailored sections specified as (x, y, z, half width, half depth)."""
    verts, uv, faces = [], [], []
    for j, (cx, cy, z, w, d) in enumerate(rings):
        for i in range(n+1):
            a = 2*pi*i/n
            ripple = 1 + folds*(sin(5*a+j*.66) + .45*sin(9*a-j*.72))
            verts.append((cx+w*cos(a)*ripple, cy+d*sin(a)*ripple, z))
            uv.append((4*i/n, 3*j/(len(rings)-1)))
            if i<n and j<len(rings)-1:
                k = j*(n+1)+i
                faces.append((k, k+1, k+n+2, k+n+1))
    faces.append(tuple(reversed(range(n))))
    faces.append(tuple(range((len(rings)-1)*(n+1), len(verts)-1)))
    return surface(name, verts, faces, m, parent, uv, True)


root = group("DeskHero")
desk = group("DESK", parent=root)
box("Slab", (.9,.375,.725), (1.8,.75,.03), laminate, desk, .005)
box("GLOW_DeskEdge", (.9,.002,.709), (1.796,.006,.006), glow, desk)
for yleg in (.06,.68):
    box("Leg", (.075,yleg,.35), (.038,.044,.70), coat, desk)
box("Foot rail", (.075,.37,.042), (.041,.66,.032), coat, desk)
box("Drawer carcass", (1.56,.43,.352), (.405,.56,.70), coat, desk, .009)
for z, h in ((.16,.264),(.435,.257),(.625,.105)):
    box("Drawer", (1.56,.144,z), (.392,.022,h), laminate, desk)
    box("Recess pull", (1.56,.131,z+h*.37), (.10,.006,.008), rubber, desk)

# The screen origin is the display centre, local -Y points toward the chair.
def monitor(label, loc, width, height, yaw):
    m = group("MON_"+label, loc, root)
    m.rotation_euler.z = radians(yaw)
    box("Shell", (0,.011,0), (width+.020,.025,height+.020), alloy, m, .006, 3)
    box("Bezel", (0,-.002,0), (width+.013,.004,height+.013), rubber, m, .002)
    w, h = width/2, height/2
    surface("SCREEN_"+label, [(-w,-.0045,-h),(w,-.0045,-h),(w,-.0045,h),(-w,-.0045,h)],
            [(0,1,2,3)], screen, m, [(0,0),(1,0),(1,1),(0,1)])
    if label != "Left":
        bottom = .74-loc[2]
        box("Foot", (0,-.005,bottom+.008), (.236,.154,.016), coat, m, .007)
        box("Neck", (0,.057,bottom/2), (.052,.036,-bottom), coat, m)
        rod("Tilt hinge", (-.03,.039,0), (.03,.039,0), .031, alloy, m)
    return m


left = monitor("Left", (.185,.525,1.165), .336,.598,18)
centre = monitor("Centre", (.755,.615,1.084), .794,.340,0)
right = monitor("Right", (1.409,.525,1.071), .531,.299,-15)
arm = group("Monitor arm", parent=desk)
box("Clamp", (.049,.735,.735), (.080,.061,.074), coat, arm)
joints = [(.049,.731,.75),(.049,.731,.993),(.277,.701,1.073),(.186,.580,1.165)]
for a,b in zip(joints,joints[1:]):
    rod("Arm segment", a,b,.018,coat,arm)
for x,y,z in joints[1:]:
    rod("Bearing", (x,y-.022,z),(x,y+.022,z),.029,alloy,arm)
bar = group("LIGHTBAR", (0,-.022,.196), centre)
rod("Tube", (-.225,0,0),(.225,0,0),.012,coat,bar,32)
box("Diffuser", (0,-.004,-.010),(.438,.013,.004),glow,bar)
box("Saddle", (0,.012,-.012),(.046,.061,.015),rubber,bar)

tower = group("PC_Tower", (1.688,.327,.74), root)
tower.rotation_euler.z = radians(-49)
box("PSU shroud", (0,0,.053), (.175,.318,.106), coat, tower,.004)
box("Top", (0,0,.396), (.175,.318,.012), coat, tower)
box("Rear", (0,.155,.201), (.175,.009,.391), coat, tower)
box("Steel side", (-.085,0,.205), (.008,.315,.384), coat, tower)
box("Mainboard", (-.048,.026,.245), (.012,.225,.218), rubber, tower)
box("Graphics card", (.002,.02,.174), (.118,.216,.041), coat, tower)
for i in range(9):
    box("Cooling fins",(-.021,-.031+i*.009,.282),(.05,.003,.065),alloy,tower,0)
for z in (.107,.384):
    box("Glass trim",(.084,0,z),(.009,.315,.008),coat,tower)
surface("Side window",[(.089,-.15,.107),(.089,.15,.107),(.089,.15,.384),(.089,-.15,.384)],
        [(0,1,2,3)],window,tower)
for y in (-.139,.139):
    for z in (.101,.371):
        rod("Thumb screw", (.094,y,z),(.088,y,z),.005,alloy,tower)
box("Intake", (0,-.161,.207),(.164,.006,.37),rubber,tower)
for i in range(15):
    box("Vent", (0,-.165,.045+i*.006),(.133,.004,.002),coat,tower,0)
ring = group("FAN_Ring",(0,-.167,.257),tower)
tube("Fan halo", [(.070*cos(i*pi/8),0,.070*sin(i*pi/8)) for i in range(16)], .0035,glow,ring,True)
blades = group("FAN_Blades",parent=ring)
for i in range(9):
    a = i*2*pi/9
    blade = ellipsoid("Impeller",(.040*cos(a),.003,.040*sin(a)),(.058,.009,.019),alloy,blades,12)
    blade.rotation_euler.y = -a-.5
rod("Hub",(0,-.006,0),(0,.006,0),.016,rubber,blades)

pad = group("MOUSEPAD", (.724,.208,.742),root)
box("Cloth pad", (0,0,0),(.90,.40,.004),padcloth,pad,.002)
# A thin inset lip masks the inner part of the shared emitter.
box("GLOW_Pad",(0,0,.0015),(.899,.399,.002),glow,pad,.001)
box("Stitched face",(0,0,.003),(.893,.393,.002),padcloth,pad,.001)
kb = group("KEYBOARD",(.535,.175,.754),root)
kb.rotation_euler.x = radians(3)
box("Keyboard case", (0,0,.007),(.327,.137,.016),coat,kb,.006)
# Legends are grouped in a single low-poly ink mesh.
rows = ["1234567890-=", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
rowspec = [[1]*15,[1]*13+[1.65,1],[1.4]+[1]*12+[1.25,1],[1.65]+[1]*11+[2,1],[2]+[1]*10+[1.65,1,1],[1.25,1.15,1.15,5.9,1.15,1.15,1,1,1,1]]
for j, widths in enumerate(rowspec):
    x0 = -.155
    y0 = .053 - j*.020
    for i, units in enumerate(widths):
        width = units*.019
        cx = x0 + width/2
        used = j == 3 or units > 5
        box("Cap",(cx,y0,.021),(width-.002,.017,.011),keycap if used else rubber,kb,.0023,1)
        label = rows[j-1][i-(j>1)] if (1<=j<=4 and 0<=i-(j>1)<len(rows[j-1])) else ""
        if label:
            font = bpy.data.curves.new("Key legend","FONT")
            font.body, font.size, font.resolution_u = label,.0054,1
            o = bpy.data.objects.new("Ink",font)
            scene.collection.objects.link(o)
            o.parent, o.location = kb,(cx-.004,y0-.001,.0266)
            font.materials.append(legend)
            bpy.ops.object.select_all(action="DESELECT")
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.convert(target="MESH")
        x0 += width
mouse = group("MOUSE",(.853,.12,.750),root)
ellipsoid("Mouse body",(0,0,.023),(.065,.11,.046),glass,mouse)
rod("Scroll wheel",(-.004,.025,.043),(.004,.025,.043),.009,rubber,mouse)
book = group("NOTEBOOK",(1.30,.139,.752),root)
book.rotation_euler.z = radians(-9)
box("Page block",(0,0,0),(.138,.195,.014),coat,book)
for z in (-.009,.009):
    box("Cover",(0,0,z),(.144,.20,.004),rubber,book,.002)
box("Elastic band",(.052,0,.011),(.005,.199,.0015),coat,book)
cables = group("CABLES",parent=root)
for i,(x,y,z) in enumerate([(.18,.56,1.15),(.75,.64,1.07),(1.41,.56,1.06)]):
    tube("Cable",[(x,y,z),(x+.06,y+.085,z-.10),(x+.09,.771,.72),
                  (x+.055,.805,.51),(x+.12,.79,.12),(x+.21,.84,.015)],.003,rubber,cables)

chair = group("CHAIR",(.51,-.65,0),root)
chair.rotation_euler.z = radians(-7)
rod("Gas lift",(0,0,.067),(0,0,.42),.026,alloy,chair)
for i in range(5):
    a = 2*pi*i/5
    end = (.275*cos(a),.275*sin(a),.061)
    rod("Spoke",(0,0,.111),end,.019,coat,chair)
    rod("Caster",(end[0]-.016,end[1],.037),(end[0]+.016,end[1],.037),.034,rubber,chair)
loft("Seat",[(0,.04,.412,.18,.18),(0,.04,.43,.245,.223),
             (0,.04,.463,.245,.231),(0,.04,.482,.221,.216)],rubber,chair)
for side in (-1,1):
    rod("Armrest strut",(side*.198,-.022,.43),(side*.24,-.03,.691),.013,alloy,chair)
    box("Armrest",(side*.24,.006,.697),(.050,.176,.025),rubber,chair,.012)

def backpoint(t,u):
    # Tapered waist and a bowed cross-section like tensioned office-chair mesh.
    w = .18+.049*sin(t*pi*.91)
    return (u*w, -.145-.116*t+.040*u*u+.023*sin(t*pi*2), .474+t*.487-.023*u*u*(t**3))

verts,uv,faces = [],[],[]
for j in range(15):
    for i in range(19):
        verts.append(backpoint(j/14,i/9-1))
        uv.append((i/18*3,j/14*3.8))
        k=j*19+i
        if i<18 and j<14:
            faces.append((k,k+1,k+20,k+19))
surface("Tensioned mesh",verts,faces,weave,chair,uv,True)
edge = [backpoint(0,-1),backpoint(0,0),backpoint(0,1),backpoint(.47,1),backpoint(.96,1),
        backpoint(1,.77),backpoint(1,0),backpoint(1,-.77),backpoint(.96,-1),backpoint(.47,-1)]
tube("Back frame",edge,.014,coat,chair,True)
for side in (-1,1):
    tube("Lumbar yoke",[(0,-.19,.443),(side*.048,-.214,.524),(side*.15,-.241,.68),
                        (side*.21,-.206,.735)],.016,coat,chair)
rod("Headrest post",(0,-.265,.917),(0,-.272,1.035),.013,alloy,chair)
loft("Head cushion",[(0,-.27,.99,.11,.022),(0,-.273,1.005,.15,.031),
                     (0,-.278,1.071,.15,.031),(0,-.275,1.09,.12,.019)],rubber,chair)

person = group("PERSON",(.51,-.49,.448),root)
# Bent legs disappear beneath the desk. Upper body pivots at the waist.
for s in (-1,1):
    ellipsoid("Thigh",(s*.105,.14,.043),(.191,.42,.129),rubber,person,12,6)
    leg = ellipsoid("Trouser leg",(s*.116,.30,-.176),(.113,.15,.41),rubber,person,12,6)
    leg.rotation_euler.x = -.15
    ellipsoid("Shoe",(s*.12,.35,-.396),(.12,.24,.077),rubber,person,12,6)
upper = group("Shoulders",(0,0,.034),person)
loft("Sweatshirt",[(0,0,0,.17,.125),(0,.003,.023,.19,.142),(0,.006,.046,.192,.14),
    (0,.024,.067,.201,.158),(0,.030,.102,.192,.151),(0,.045,.127,.200,.165),
    (0,.056,.164,.186,.158),(0,.060,.22,.179,.148),(0,.068,.279,.196,.154),
    (0,.082,.361,.215,.151),(0,.10,.427,.246,.137),(0,.107,.459,.23,.122),
    (0,.111,.487,.143,.095),(0,.109,.492,.09,.08)],cloth,upper,28,.038)
# The raised hood is a single sewn shell. Its face opening points at the
# displays. A centre seam and a rolled collar separate it from the shoulders.
hood_rings = [(0,.084,.426,.091,.087),(0,.081,.439,.127,.132),(0,.087,.461,.144,.139),
              (0,.087,.482,.129,.128),(0,.091,.506,.132,.137),(0,.098,.56,.132,.143),
              (0,.108,.629,.125,.135),(0,.113,.680,.106,.12),(0,.117,.719,.080,.089),
              (0,.122,.742,.043,.053),(0,.125,.749,.009,.014)]
loft("Raised hood",hood_rings,cloth,upper,28,.018)
tube("Hood seam",[(x, y-d-.001,z) for x,y,z,w,d in hood_rings[2:]],.0016,rubber,upper)
tube("Collar fold",[(-.134,.106,.468),(-.102,-.009,.464),(0,-.049,.452),
                    (.103,-.01,.463),(.134,.107,.471)],.004,cloth,upper)

def sleeve(points, radii):
    verts, uv, faces = [],[],[]
    pts = [Vector(v) for v in points]
    n = 16
    for j,(p,r) in enumerate(zip(pts,radii)):
        tangent = (pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)]).normalized()
        x = tangent.cross(Vector((0,0,1))).normalized()
        y = tangent.cross(x)
        for i in range(n+1):
            a = 2*pi*i/n
            rr = r*(1+.047*sin(4*a+j*1.6))
            verts.append(p+rr*(cos(a)*x+sin(a)*y))
            uv.append((i/n*2,j/len(pts)*3))
            k = j*(n+1)+i
            if i<n and j<len(pts)-1:
                faces.append((k,k+1,k+n+2,k+n+1))
    faces.append(tuple(range((len(pts)-1)*(n+1),len(verts)-1)))
    surface("Gathered sleeve",verts,faces,cloth,upper,uv,True)

sleeve([(.176,.10,.429),(.216,.114,.414),(.247,.142,.366),(.26,.19,.313),
        (.276,.226,.267),(.277,.247,.241),(.288,.277,.246),(.284,.313,.244),
        (.30,.365,.257),(.306,.408,.259),(.315,.466,.273),(.316,.49,.273),
        (.317,.505,.273)], [.067,.084,.077,.067,.064,.074,.063,.066,.058,.058,.046,.043,.040])
sleeve([(-.18,.097,.424),(-.219,.117,.398),(-.24,.175,.335),(-.24,.211,.28),
        (-.225,.246,.248),(-.21,.285,.24),(-.185,.324,.249),(-.154,.391,.257),
        (-.117,.458,.267),(-.085,.518,.275),(-.066,.554,.276)],
       [.070,.082,.07,.069,.067,.067,.061,.052,.049,.045,.039])
# A single exposed right wrist, tapered fingers curved over the mouse buttons.
hand = group("Right hand",(.325,.548,.328),person)
ellipsoid("Wrist",(-.004,-.018,-.002),(.061,.078,.043),skin,hand)
palm = ellipsoid("Palm",(.007,.028,.01),(.082,.1,.051),skin,hand)
palm.rotation_euler.y = -.15
for i,(dx,reach) in enumerate([(-.022,.059),(-.002,.064),(.017,.056),(.034,.042)]):
    knuckle=(dx+.006,.054,.015-i*.0015)
    mid=(dx+.009,.054+reach*.53,.025-i*.002)
    tip=(dx+.011,.054+reach,.006-i*.003)
    tube("Finger",[knuckle,mid,tip],.0087-i*.0006,skin,hand)
    ellipsoid("Fingertip",tip,(.016,.017,.014),skin,hand,10,6)
tube("Thumb",[(-.023,.022,.003),(-.039,.044,-.004),(-.032,.069,-.012)],.010,skin,hand)

wall = group("WALL",parent=root)
box("Backdrop",(.9,1.02,3),(30,.05,6),material("MAT_Wall","141416",.9),wall,0)
floor_mat = material("MAT_Floor","0b0b0c",.85)
floor = surface("Floor",[(-5,-7,0),(7,-7,0),(7,2,0),(-5,2,0)],[(0,1,2,3)],
                floor_mat,wall,[(0,0),(1,0),(1,1),(0,1)])

# Merge fixed details by material within each pivot. Preserve every named
# interaction surface, the four glow emitters, and animated pivots.
def select(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


buckets = {}
for o in list(scene.objects):
    if o.type=="MESH" and not o.name.startswith(("SCREEN_","GLOW_")):
        buckets.setdefault((o.parent,o.data.materials[0]),[]).append(o)
for items in buckets.values():
    if len(items)>1:
        select(items)
        bpy.ops.object.join()

# A genuine shared second-UV AO atlas. Only baked meshes get AO materials,
# so a steel part elsewhere cannot accidentally sample the chair's atlas.
baked = [o for g in (desk,chair,person) for o in g.children_recursive
         if o.type=="MESH" and o.data.materials[0] != glow]
atlas = bpy.data.images.new("Desk chair and hoodie AO",1024,1024,alpha=False)
atlas.colorspace_settings.name = "Non-Color"
ao_group = bpy.data.node_groups.new("glTF Material Output","ShaderNodeTree")
ao_group.interface.new_socket("Occlusion",in_out="INPUT",socket_type="NodeSocketFloat")
copies = {}
for o in baked:
    m = o.data.materials[0]
    if m not in copies:
        copy = m.copy()
        copies[m] = copy
        nt = copy.node_tree
        tex = image_node(copy,atlas)
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "AO"
        nt.links.new(uv.outputs[0],tex.inputs[0])
        group_node = nt.nodes.new("ShaderNodeGroup")
        group_node.node_tree = ao_group
        nt.links.new(tex.outputs[0],group_node.inputs["Occlusion"])
        nt.nodes.active = tex
    o.data.materials[0] = copies[m]
    if not o.data.uv_layers:
        o.data.uv_layers.new(name="UVMap")
    o.data.uv_layers.new(name="AO")
    o.data.uv_layers.active_index = 1
select(baked)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=radians(70),island_margin=.003,area_weight=.6)
bpy.ops.object.mode_set(mode="OBJECT")
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.world = bpy.data.worlds.new("Bake world")
scene.world.color = (.8,.8,.8)
bpy.ops.object.bake(type="AO",margin=3,use_clear=True,uv_layer="AO")
atlas.pack()
for o in baked:
    o.data.uv_layers.active_index = 0
    o.data.uv_layers[0].active_render = True
# Contact under the casters, feet and cabinet grounds the scene in the room.
floor_ao = bpy.data.images.new("Floor contact",256,256,alpha=False)
floor_ao.colorspace_settings.name = "Non-Color"
tex = image_node(floor_mat,floor_ao)
floor_out = floor_mat.node_tree.nodes.new("ShaderNodeGroup")
floor_out.node_tree = ao_group
floor_mat.node_tree.links.new(tex.outputs[0],floor_out.inputs["Occlusion"])
floor_mat.node_tree.nodes.active = tex
select([floor])
bpy.ops.object.bake(type="AO",margin=2,use_clear=True)
floor_ao.pack()
OUT.parent.mkdir(parents=True,exist_ok=True)
def triangles(objects):
    return sum(len(p.vertices)-2 for o in objects if o.type=="MESH" for p in o.data.polygons)

person_tris = triangles(person.children_recursive)
scene_tris = triangles(scene.objects)
assert person_tris < 6000 and scene_tris < 60000, (person_tris, scene_tris)
print(f"Desk: {scene_tris} triangles, including {person_tris} for the seated figure")
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format="GLB",export_yup=True,
                          export_texcoords=True,export_materials="EXPORT",export_animations=False)
