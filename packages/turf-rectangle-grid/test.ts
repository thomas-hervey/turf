import fs from "fs";
import test from "tape";
import path from "path";
import { fileURLToPath } from "url";
import { loadJsonFileSync } from "load-json-file";
import { writeJsonFileSync } from "write-json-file";
import { bboxPolygon as bboxPoly } from "@turf/bbox-polygon";
import { truncate } from "@turf/truncate";
import { rectangleGrid } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const directories = {
  in: path.join(__dirname, "test", "in") + path.sep,
  out: path.join(__dirname, "test", "out") + path.sep,
};

let fixtures = fs.readdirSync(directories.in).map((filename) => {
  return {
    filename,
    name: path.parse(filename).name,
    json: loadJsonFileSync(directories.in + filename),
  };
});

test("rectangle-grid", (t) => {
  for (const { name, json } of fixtures) {
    const { bbox, cellWidth, cellHeight, units, properties, mask } = json;
    const options = {
      mask,
      units,
      properties,
    };
    const result = truncate(
      rectangleGrid(bbox, cellWidth, cellHeight, options)
    );

    // Add styled GeoJSON to the result
    const poly = bboxPoly(bbox);
    poly.properties = {
      stroke: "#F00",
      "stroke-width": 6,
      "fill-opacity": 0,
    };
    result.features.push(poly);
    if (options.mask) {
      options.mask.properties = {
        stroke: "#00F",
        "stroke-width": 6,
        "fill-opacity": 0,
      };
      result.features.push(options.mask);
    }

    if (process.env.REGEN)
      writeJsonFileSync(directories.out + name + ".geojson", result);
    t.deepEqual(
      result,
      loadJsonFileSync(directories.out + name + ".geojson"),
      name
    );
  }
  t.end();
});
