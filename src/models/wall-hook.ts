import { getManifold } from "../manifold";
import { resolveScrew, resolveDriverDiameter } from "../screws";
import { type Manifold } from "manifold-3d";

export interface Params {
  wall_side_height: number
  depth: number
  width: number
  lip_height: number
  lip_thickness: number
  lip_edge_radius: number
  screw_holes: number
  screw_spacing: number
  screw_type: string
  screw_shaft: number
  screw_head: number
  driver_type: string
  driver_diameter: number
  countersunk: boolean
}

export function generate({
  wall_side_height: wallHeight, depth, width, lip_height: lipHeight, lip_thickness: lipThickness,
  lip_edge_radius: edgeRadius, screw_holes: holeCount, screw_spacing: screwSpacing,
  screw_type: screwType, screw_shaft: screwShaft, screw_head: screwHead,
  driver_type: driverType, driver_diameter: driverDiameterCustom, countersunk
}: Params): { geom: Manifold; exportTransform: (g: Manifold) => Manifold } {
  const { Manifold } = getManifold();

  const { shaft: shaftDiameter, head: headDiameter } = resolveScrew(screwType, screwShaft, screwHead);
  const driverDiameter = resolveDriverDiameter(driverType, driverDiameterCustom);

  // Coordinate system: X = width, Y = height (up when mounted), Z = depth from wall
  //
  // Triangle in Y-Z plane:
  //   P1 = (y=0,          z=0    ): bottom of wall face
  //   P2 = (y=wallHeight, z=0    ): top of wall face — right angle (a meets b)
  //   P3 = (y=wallHeight, z=depth): far tip of hook arm (b meets c)
  //   Side a: P1->P2 at z=0          (wall face -- screw holes perpendicular through this)
  //   Side b: P2->P3 at y=wallHeight (hook arm -- lip at far end)
  //   Side c: P3->P1                  (hypotenuse -- print base)

  const hypotenuse = Math.sqrt(wallHeight * wallHeight + depth * depth);
  const angle = Math.atan2(depth, wallHeight) * (180 / Math.PI);

  // Cylinder along X axis of length width, radius r, centered at (y, z)
  const xCyl = (r: number, y: number, z: number) =>
    Manifold.cylinder(width, r, r, 32)
      .rotate([0, 90, 0])
      .translate([-width / 2, y, z]);

  // Triangular prism: bounding box minus a rotated cutter that removes the region
  // below the hypotenuse. Rotating by `angle` around X aligns the cutter's +Y'
  // with the hypotenuse and its +Z' into the removal region.
  const bounds = Manifold.cube([width, wallHeight, depth]).translate([-width / 2, 0, 0]);
  const cutter = Manifold.cube([width + 2, hypotenuse + 10, hypotenuse + 10])
    .translate([-width / 2 - 1, 0, 0])
    .rotate([angle, 0, 0]);
  const prism = bounds.subtract(cutter);

  // Lip: rises above the hook arm at the far tip (z=depth, y=wallHeight)
  let lip: Manifold;
  if (edgeRadius <= 0) {
    lip = Manifold.cube([width, lipHeight, lipThickness]).translate([-width / 2, wallHeight, depth - lipThickness]);
  } else {
    const lipRadius = Math.min(edgeRadius, lipHeight / 2 - 0.01, lipThickness / 2 - 0.01);
    const roundedLip = Manifold.hull([
      xCyl(lipRadius, wallHeight + lipRadius, depth - lipThickness + lipRadius),
      xCyl(lipRadius, wallHeight + lipRadius, depth - lipRadius),
      xCyl(lipRadius, wallHeight + lipHeight - lipRadius, depth - lipThickness + lipRadius),
      xCyl(lipRadius, wallHeight + lipHeight - lipRadius, depth - lipRadius)
    ]);
    // Sharp bottom strip so the junction with the prism arm face stays crisp
    const lipBase = Manifold.cube([width, lipRadius, lipThickness]).translate([-width / 2, wallHeight, depth - lipThickness]);
    lip = roundedLip.add(lipBase);
  }

  const body = prism.add(lip);

  const printAngle = Math.atan2(wallHeight, depth) * (180 / Math.PI)
  const exportTransform = (g: Manifold) => g.rotate(printAngle, 0, 0)

  if (holeCount === 0) return { geom: body, exportTransform };

  const coneRadius = headDiameter / 2;
  const countersinkDepth = coneRadius - shaftDiameter / 2;  // 90 degree countersink depth
  const boreRadius = Math.max(coneRadius, driverDiameter / 2); // enforce minimum = head radius

  const makeHole = (x: number) => {
    const y = wallHeight / 2;
    const surfaceZ = y * depth / wallHeight;  // hypotenuse Z at this Y height
    // The hypotenuse slopes at depth/wallHeight, so the bore (radius boreRadius) must extend
    // boreRadius * depth/wallHeight past surfaceZ to exit cleanly at the high-Y edge.
    const boreOvershoot = boreRadius * depth / wallHeight + 1;

    // Shaft exits through side a into the wall
    const shaft = Manifold.cylinder(countersinkDepth + 1, shaftDiameter / 2, shaftDiameter / 2, 32)
      .translate([x, y, -1]);

    if (!countersunk) {
      // No countersink: flat shoulder at z=countersinkDepth -- screw head pushes against this lip
      const bore = Manifold.cylinder(surfaceZ - countersinkDepth + boreOvershoot, boreRadius, boreRadius, 32)
        .translate([x, y, countersinkDepth]);
      return shaft.add(bore);
    }

    // Countersink cone at side a: shaftDiameter/2 at z=0, widens to coneRadius at z=countersinkDepth (90 degree seat)
    const cone = Manifold.cylinder(countersinkDepth, shaftDiameter / 2, coneRadius, 32)
      .translate([x, y, 0]);
    // Bore from cone to hypotenuse -- at least head diameter, wider if driver_diameter > head
    const bore = Manifold.cylinder(surfaceZ - countersinkDepth + boreOvershoot, boreRadius, boreRadius, 32)
      .translate([x, y, countersinkDepth]);

    return shaft.add(cone).add(bore);
  };

  if (holeCount === 1) return { geom: body.subtract(makeHole(0)), exportTransform };

  const geom = Array.from({ length: holeCount }, (_, i) => (i - (holeCount - 1) / 2) * screwSpacing)
    .reduce((acc, x) => acc.subtract(makeHole(x)), body);
  return { geom, exportTransform };
}
