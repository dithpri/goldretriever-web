/**
 * Copyright (C) 2016-2017 Auralia
 * Modifications copyright (C) 2020 dithpri (Racoda)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

var browserify = require("browserify");
var buffer = require("vinyl-buffer");
var del = require("del");
var gulp = require("gulp");
var source = require("vinyl-source-stream");
var sourcemaps = require("gulp-sourcemaps");
var tsify = require("tsify");
var uglify = require("gulp-uglify");

gulp.task("clean", function() {
    return del("build");
});

gulp.task("copy-html", function() {
    return gulp.src(["src/*.html"])
        .pipe(gulp.dest("build"))
});

gulp.task("copy-css", function() {
    return gulp.src(["src/css/**"])
               .pipe(gulp.dest("build/css"))
});

gulp.task("copy-js", function() {
    return gulp.src(["src/table-sort.js"])
               .pipe(gulp.dest("build/js"))
});

gulp.task("copy-third-party", function() {
    return gulp.src(["src/third-party/**"])
               .pipe(gulp.dest("build/third-party"))
});

gulp.task("prod", gulp.series("clean", gulp.parallel(["copy-html", "copy-css",
                   "copy-third-party", "copy-js"], function() {
    return browserify({
                          debug: false,
                          entries: "src/ts/main.ts",
                          extensions: [".ts"]
                      })
        .plugin(tsify)
        .bundle()
        .on("error", function(err) {
            console.error(err.message);
            this.on("end", function() {
                process.exit(1)
            });
        })
        .pipe(source("bundle.js"))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest("build/js"));
})));

gulp.task("dev", gulp.series("clean", gulp.parallel(["copy-html", "copy-css",
                  "copy-third-party", "copy-js"], function() {
    return browserify({
                          debug: true,
                          entries: "src/ts/main.ts",
                          extensions: [".ts"]
                      })
        .plugin(tsify)
        .bundle()
        .on("error", function(err) {
            console.error(err.message);
            this.on("end", function() {
                process.exit(1)
            });
        })
        .pipe(source("bundle.js"))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify())
        .pipe(sourcemaps.write({includeContent: false, sourceRoot: "../../"}))
        .pipe(gulp.dest("build/js"));
})));

gulp.task("default", gulp.series(["prod"]));
