import fs from "fs";
import test from "tape";
import path from "path";
import { fileURLToPath } from "url";
import { loadJsonFileSync } from "load-json-file";
import { writeJsonFileSync } from "write-json-file";
import type {
  FeatureCollection,
  LineString,
  Feature,
  Geometry,
  Point,
  MultiLineString,
} from "geojson";
import { truncate } from "@turf/truncate";
import { featureCollection, point, lineString } from "@turf/helpers";
import { greatCircle } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const directories = {
  in: path.join(__dirname, "test", "in") + path.sep,
  out: path.join(__dirname, "test", "out") + path.sep,
};

const fixtures = fs.readdirSync(directories.in).map((filename) => {
  return {
    filename,
    name: path.parse(filename).name,
    geojson: loadJsonFileSync(
      path.join(directories.in, filename)
    ) as FeatureCollection,
  };
});

// Function to get the start and end points from the fixture
function getStartEndPoints(fixture: (typeof fixtures)[0]) {
  const geojson = fixture.geojson;
  const start = geojson.features[0] as Feature<Point>;
  const end =
    geojson.features.length > 1
      ? (geojson.features[1] as Feature<Point>)
      : undefined;
  return { start, end };
}

test("turf-great-circle", (t) => {
  fixtures.forEach((fixture) => {
    const name = fixture.name;
    const filename = fixture.filename;
    const { start, end } = getStartEndPoints(fixture);

    let line;
    if (end) {
      line = truncate(greatCircle(start, end));
    } else {
      // Assume this is a bearing case if there's no end point
      line = truncate(
        greatCircle(start, undefined, { bearing: 270, npoints: 100 })
      );
    }

    const results = featureCollection<Geometry>([
      line,
      start,
      ...(end ? [end] : []),
    ]);

    if (process.env.REGEN)
      writeJsonFileSync(directories.out + filename, results);
    t.deepEquals(results, loadJsonFileSync(directories.out + filename), name);
  });
  t.end();
});

test("turf-great-circle with same input and output", (t) => {
  const start = point([0, 0]);
  const end = point([0, 0]);
  const line = greatCircle(start, end, {
    npoints: 4,
  });

  t.deepEquals(
    lineString([
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]),
    line as Feature<LineString>
  );

  t.end();
});

test("turf-great-circle accepts Feature<Point> inputs", (t) => {
  const { start, end } = getStartEndPoints(fixtures[0]);
  t.doesNotThrow(
    () => greatCircle(start, end),
    "accepts Feature<Point> inputs"
  );
  t.end();
});

test("turf-great-circle accepts Point geometry inputs", (t) => {
  const { start, end } = getStartEndPoints(fixtures[0]);
  t.doesNotThrow(
    () => greatCircle(start.geometry, end?.geometry),
    "accepts Point geometry inputs"
  );
  t.end();
});

test("turf-great-circle accepts Position inputs", (t) => {
  const { start, end } = getStartEndPoints(fixtures[0]);
  t.doesNotThrow(
    () => greatCircle(start.geometry.coordinates, end?.geometry.coordinates),
    "accepts Position inputs"
  );
  t.end();
});

test("turf-great-circle applies custom properties", (t) => {
  const { start, end } = getStartEndPoints(fixtures[0]);
  const withProperties = greatCircle(start, end, {
    properties: { name: "Test Route" },
  });
  t.equal(
    withProperties.properties?.name,
    "Test Route",
    "applies custom properties"
  );
  t.end();
});

test("turf-great-circle respects npoints option", (t) => {
  const { start, end } = getStartEndPoints(fixtures[0]);
  const withCustomPoints = greatCircle(start, end, { npoints: 5 });
  t.equal(
    (withCustomPoints.geometry as LineString).coordinates.length,
    5,
    "respects npoints option"
  );
  t.end();
});

test("turf-great-circle respects offset and npoints options", (t) => {
  const { start, end } = getStartEndPoints(fixtures[0]);
  const withOffset = greatCircle(start, end, { offset: 100, npoints: 10 });
  t.equal(
    (withOffset.geometry as LineString).coordinates.length,
    10,
    "respects offset and npoints options"
  );
  t.end();
});

test("turf-great-circle with bearing", (t) => {
  const fixture = fixtures.find((f) => f.filename === "bearing-no-end.geojson");
  if (!fixture) {
    t.fail("bearing-no-end.geojson fixture not found");
    return t.end();
  }

  const { start } = getStartEndPoints(fixture);
  const line = truncate(
    greatCircle(start, undefined, { bearing: 270, npoints: 100 })
  );

  t.ok(line, "creates a great circle with bearing and no end point");
  t.equal(line.geometry.type, "MultiLineString", "returns a MultiLineString");
  // Note: We expect 2 coordinates because it is a multi-line string and therefore there are two line arrays
  t.equal(
    (line.geometry as MultiLineString).coordinates.length,
    2,
    "has 2 coordinates"
  );

  const results = featureCollection<Geometry>([line, start]);

  if (process.env.REGEN)
    writeJsonFileSync(directories.out + "bearing-no-end.geojson", results);

  const expected: MultiLineString = loadJsonFileSync(
    directories.out + "bearing-no-end.geojson"
  );
  t.deepEquals(results, expected, "bearing case");
  t.end();
});

test("turf-great-circle with end point and bearing", (t) => {
  const { start, end } = getStartEndPoints(fixtures[0]);
  const withEndAndBearing = greatCircle(start, end, { bearing: 90 });
  const withEndOnly = greatCircle(start, end);
  t.deepEquals(
    withEndAndBearing,
    withEndOnly,
    "bearing is ignored when end point is provided"
  );
  t.end();
});

test("turf-great-circle with no end point and no bearing", (t) => {
  const start = point([-122, 48]);
  t.throws(
    () => greatCircle(start),
    /Either 'end' or 'options.bearing' must be provided/,
    "throws an error when neither end nor bearing is provided"
  );
  t.end();
});
