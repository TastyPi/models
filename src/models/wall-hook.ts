import { getManifold } from "../manifold";
import { defineModel } from "../types";
import { type Manifold } from "manifold-3d";

export default defineModel({
  name: "Wall Hook",
  description: "Triangular prism hook. Side (a) mounts against the wall with screw holes, side (b) is the hook arm with a retention lip, side (c) is the hypotenuse — print flat on side (c), no supports needed.",
  parameters: {
    wall_side_height: { type: "number", label: "Wall Side Height (mm)", default: 20, min: 20, max: 150, step: 1 },
    depth: { type: "number", label: "Depth (mm)", default: 20, min: 5, max: 150, step: 1 },
    width: { type: "number", label: "Width (mm)", default: 50, min: 10, max: 100, step: 1 },
    lip_edge_radius: {
      type: "number", label: "Lip Edge Radius (mm)", default: 5, min: 0,
      max: (v) => Math.floor(Math.min(v.lip_thickness as number, v.lip_height as number) / 2 / 0.5) * 0.5,
      step: 0.5
    },
    lip_height: { type: "number", label: "Lip Height (mm)", default: 25, min: 5, max: 50, step: 1 },
    lip_thickness: { type: "number", label: "Lip Thickness (mm)", default: 10, min: 2, max: 20, step: 0.5 },
    screw_holes: { type: "number", label: "Screw Holes", default: 2, min: 0, max: 6, step: 1 },
    screw_size: {
      type: "number",
      label: "Screw Size",
      default: 4,
      min: 3,
      max: 6,
      step: 1,
      description: "Nominal metric size: 3=M3, 4=M4, 5=M5, 6=M6. Head diameter per ISO 10642."
    },
    driver_diameter: {
      type: "number",
      label: "Driver Diameter (mm)",
      default: 10,
      min: 7,
      max: 30,
      step: 0.5,
      description: "Bore diameter through side (c). Default matches the LTT screwdriver (10 mm). Must be at least the screw head diameter."
    },
    countersunk: { type: "boolean", label: "Countersunk", default: true }
  },
  groups: [
    { label: "Shape", keys: ["wall_side_height", "depth", "width"], defaultOpen: true },
    { label: "Lip", keys: ["lip_height", "lip_thickness", "lip_edge_radius"], defaultOpen: true },
    { label: "Screws", keys: ["screw_holes", "screw_size", "driver_diameter", "countersunk"], defaultOpen: true }
  ],

  generate({
             wall_side_height: wallHeight, depth, width, lip_height: lipHeight, lip_thickness: lipThickness,
             lip_edge_radius: edgeRadius, screw_holes: holeCount, screw_size: screwSize,
             driver_diameter: driverDiameter, countersunk
           }) {
    const { Manifold } = getManifold();

    // ISO 10642 (90° countersunk) head dimensions
    const screwDims: Record<number, { shaft: number; head: number }> = {
      3: { shaft: 3, head: 6.72 },
      4: { shaft: 4, head: 8.96 },
      5: { shaft: 5, head: 11.20 },
      6: { shaft: 6, head: 13.44 }
    };
    const { shaft: shaftDiameter, head: headDiameter } = screwDims[screwSize] ?? screwDims[4];

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
      const roundedLip = (Manifold as any).hull([
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

    if (holeCount === 0) return body;

    const coneRadius = headDiameter / 2;
    const countersinkDepth = coneRadius - shaftDiameter / 2;  // 90 degree countersink depth
    const boreRadius = Math.max(coneRadius, driverDiameter / 2); // enforce minimum = head radius

    const makeHole = (x: number) => {
      const y = wallHeight / 2;
      const surfaceZ = y * depth / wallHeight;  // hypotenuse Z at this Y height

      // Shaft exits through side a into the wall
      const shaft = Manifold.cylinder(countersinkDepth + 1, shaftDiameter / 2, shaftDiameter / 2, 32)
        .translate([x, y, -1]);

      if (!countersunk) {
        // No countersink: flat shoulder at z=countersinkDepth -- screw head pushes against this lip
        const bore = Manifold.cylinder(surfaceZ - countersinkDepth + 2, boreRadius, boreRadius, 32)
          .translate([x, y, countersinkDepth]);
        return shaft.add(bore);
      }

      // Countersink cone at side a: shaftDiameter/2 at z=0, widens to coneRadius at z=countersinkDepth (90 degree seat)
      const cone = Manifold.cylinder(countersinkDepth, shaftDiameter / 2, coneRadius, 32)
        .translate([x, y, 0]);
      // Bore from cone to hypotenuse -- at least head diameter, wider if driver_diameter > head
      const bore = Manifold.cylinder(surfaceZ - countersinkDepth + 2, boreRadius, boreRadius, 32)
        .translate([x, y, countersinkDepth]);

      return shaft.add(cone).add(bore);
    };

    const boreDiameter = boreRadius * 2;
    const gap = (width - holeCount * boreDiameter) / (holeCount + 1);
    return Array.from({ length: holeCount }, (_, i) => -width / 2 + (i + 1) * gap + (2 * i + 1) * boreRadius)
      .reduce((acc, x) => acc.subtract(makeHole(x)), body);
  },

  exportTransform({ wall_side_height: wallHeight, depth }, geom) {
    // Rotate so side c (hypotenuse) is flat on the print bed, then Z-up for slicers
    const printAngle = Math.atan2(wallHeight as number, depth as number) * (180 / Math.PI)
    return (geom as any).rotate([printAngle, 0, 0])
  }
});
