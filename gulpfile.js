import gulp from 'gulp';
import plumber from 'gulp-plumber';
import notify from 'gulp-notify';
import gulpSass from 'gulp-sass';
import * as sassCompiler from 'sass';
const sass = gulpSass(sassCompiler);
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import prettier from 'gulp-prettier';
import cleanCSS from 'gulp-clean-css';
import stripComments from 'gulp-strip-css-comments';
import rename from 'gulp-rename';
import webpackStream from 'webpack-stream';
import webpack from 'webpack';
import panini from 'panini';
import image from 'gulp-image';
import del from 'del';
import browserSyncLib from 'browser-sync';

// Destructure gulp methods after default import
const { src, dest, series, parallel, watch } = gulp;
const browserSync = browserSyncLib.create();

// Paths
const srcPath = 'src/';
const distPath = 'dist/';
const path = {
  build: {
    html:   distPath,
    js:     `${distPath}assets/js/`,
    css:    `${distPath}assets/css/`,
    images: `${distPath}assets/images/`,
    fonts:  `${distPath}assets/fonts/`
  },
  src: {
    html:   `${srcPath}*.html`,
    js:     `${srcPath}assets/js/*.js`,
    css:    `${srcPath}assets/scss/**/*.scss`,
    images: `${srcPath}assets/images/**/*.{jpg,png,svg,gif,ico,webp,webmanifest,xml,json}`,
    fonts:  `${srcPath}assets/fonts/**/*.{eot,woff,woff2,ttf,svg}`
  },
  watch: {
    html:   `${srcPath}**/*.html`,
    js:     `${srcPath}assets/js/**/*.js`,
    css:    `${srcPath}assets/scss/**/*.scss`,
    images: `${srcPath}assets/images/**/*.{jpg,png,svg,gif,ico,webp,webmanifest,xml,json}`,
    fonts:  `${srcPath}assets/fonts/**/*.{eot,woff,woff2,ttf,svg}`
  },
  clean: `./${distPath}`
};

// Serve
function serve() {
  browserSync.init({
    server: { baseDir: path.build.html },
    browser: 'Firefox Developer Edition'
  });
}

// HTML
function html() {
  panini.refresh();
  return src(path.src.html, { base: srcPath })
    .pipe(plumber())
    .pipe(panini({
      root:    srcPath,
      layouts: `${srcPath}layouts/`,
      partials:`${srcPath}partials/`,
      helpers:`${srcPath}helpers/`,
      data:    `${srcPath}data/`
    }))
    .pipe(dest(path.build.html))
    .pipe(browserSync.reload({ stream: true }));
}

// CSS
function css() {
  return src(path.src.css, { base: `${srcPath}assets/scss/` })
    .pipe(plumber({ errorHandler(err) {
      notify.onError({ title: 'SCSS Error', message: '<%= error.message %>' })(err);
      this.emit('end');
    }}))
    .pipe(sass({ includePaths: ['./node_modules/'] }))
    .pipe(postcss([ autoprefixer({ cascade: true }) ]))
    .pipe(prettier({ parser: 'css', tabWidth: 2 }))
    .pipe(dest(path.build.css))
    .pipe(cleanCSS({ level: { 1: { specialComments: 0 } } }))
    .pipe(stripComments())
    .pipe(rename({ suffix: '.min', extname: '.css' }))
    .pipe(dest(path.build.css))
    .pipe(browserSync.reload({ stream: true }));
}

// CSS Watch
function cssWatch() {
  return src(path.src.css, { base: `${srcPath}assets/scss/` })
    .pipe(plumber({ errorHandler(err) {
      notify.onError({ title: 'SCSS Error', message: '<%= error.message %>' })(err);
      this.emit('end');
    }}))
    .pipe(sass({ includePaths: ['./node_modules/'] }))
    .pipe(rename({ suffix: '.min', extname: '.css' }))
    .pipe(dest(path.build.css))
    .pipe(browserSync.reload({ stream: true }));
}

// JS
function js() {
  return src(path.src.js, { base: `${srcPath}assets/js/` })
    .pipe(plumber({ errorHandler(err) {
      notify.onError({ title: 'JS Error', message: '<%= error.message %>' })(err);
      this.emit('end');
    }}))
    .pipe(webpackStream({ mode: 'production', output: { filename: 'app.js' } }, webpack))
    .pipe(dest(path.build.js))
    .pipe(browserSync.reload({ stream: true }));
}

// JS Watch
function jsWatch() {
  return src(path.src.js, { base: `${srcPath}assets/js/` })
    .pipe(plumber({ errorHandler(err) {
      notify.onError({ title: 'JS Error', message: '<%= error.message %>' })(err);
      this.emit('end');
    }}))
    .pipe(webpackStream({ mode: 'development', output: { filename: 'app.js' } }, webpack))
    .pipe(dest(path.build.js))
    .pipe(browserSync.reload({ stream: true }));
}

// Images
function images() {
  return src(path.src.images)
    .pipe(image({ concurrent: 5 }))
    .pipe(dest(path.build.images))
    .pipe(browserSync.reload({ stream: true }));
}

// Fonts
function fonts() {
  return src(path.src.fonts)
    .pipe(dest(path.build.fonts))
    .pipe(browserSync.reload({ stream: true }));
}

// Clean
function clean() {
  return del(path.clean);
}

// Watch Files
function watchFiles() {
  watch(path.watch.html, html);
  watch(path.watch.css, cssWatch);
  watch(path.watch.js, jsWatch);
  watch(path.watch.images, images);
  watch(path.watch.fonts, fonts);
}

// Build & Dev
const build = series(clean, parallel(html, css, js, images, fonts));
const dev = parallel(build, watchFiles, serve);

// Exports
export { html, css, js, images, fonts, clean, build };
export { dev as watch };
export default dev;
