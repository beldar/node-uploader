'use strict';

var gulp       = require('gulp'),
    sass       = require('gulp-sass'),
    sourcemaps = require('gulp-sourcemaps'),
    nodemon    = require('gulp-nodemon');

gulp.task('sass', function () {
  return gulp.src('./frontend/sass/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./frontend/css'));
});

gulp.task('sass:watch', function () {
  gulp.watch('./frontend/sass/**/*.scss', ['sass']);
});

gulp.task('start', ['sass'], function () {
  nodemon({
    exec: 'electron',
    script: 'main.js',
    ext: 'html js css',
    env: { 'NODE_ENV': 'development' },
    watch: ['main.js', 'frontend']
  })
  .on('restart', function () {
    console.log('restarted!')
  })
});
