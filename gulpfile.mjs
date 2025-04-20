import gulp from 'gulp';
import * as glob from 'glob';
import * as nodePath from 'path';
import plumber from 'gulp-plumber';
import notify from 'gulp-notify';
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';
const sass = gulpSass(dartSass);
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

// Ensure required dependencies are installed:
// npm install --save-dev babel-loader @babel/core @babel/preset-env
// npm install --save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions draco3dgltf
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);

// Destructure gulp methods after default import
const { src, dest, series, parallel, watch } = gulp;
const browserSync = browserSyncLib.create();

// Paths
const srcPath = 'src/';
const distPath = 'dist/';
const paths = {
  build: {
    html:   distPath,
    js:     `${distPath}assets/js/`,
    css:    `${distPath}assets/css/`,
    images: `${distPath}assets/images/`,
    fonts:  `${distPath}assets/fonts/`
  },
  src: {
    html:   `${srcPath}*.html`,
    js:     `${srcPath}assets/js/**/*.js`,
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
function serve(done) {
  browserSync.init({
    server: { baseDir: paths.build.html },
    browser: 'Firefox Developer Edition'
  });
  done();
}

// HTML
function html() {
  panini.refresh();
  return src(paths.src.html, { base: srcPath })
    .pipe(plumber())
    .pipe(panini({
      root:    srcPath,
      layouts: `${srcPath}layouts/`,
      partials:`${srcPath}partials/`,
      helpers:`${srcPath}helpers/`,
      data:    `${srcPath}data/`
    }))
    .pipe(dest(paths.build.html))
    .pipe(browserSync.reload({ stream: true }));
}

// CSS
function css() {
  return src(`${srcPath}assets/scss/style.scss`, { base: `${srcPath}assets/scss/` })
    .pipe(plumber({ errorHandler(err) {
      notify.onError({ title: 'SCSS Error', message: '<%= error.message %>' })(err);
      this.emit('end');
    }}))
    .pipe(sass({ includePaths: ['./node_modules/'] }))
    .pipe(postcss([ autoprefixer({ cascade: true }) ]))
    .pipe(prettier({ parser: 'css', tabWidth: 2 }))
    .pipe(dest(paths.build.css))
    .pipe(cleanCSS({ level: { 1: { specialComments: 0 } } }))
    .pipe(stripComments())
    .pipe(rename({ suffix: '.min', extname: '.css' }))
    .pipe(dest(paths.build.css))
    .pipe(browserSync.reload({ stream: true }));
}

// CSS Watch
function cssWatch() {
  return src(`${srcPath}assets/scss/style.scss`, { base: `${srcPath}assets/scss/` })
    .pipe(plumber({ errorHandler(err) {
      notify.onError({ title: 'SCSS Error', message: '<%= error.message %>' })(err);
      this.emit('end');
    }}))
    .pipe(sass({ includePaths: ['./node_modules/'] }))
    .pipe(rename({ suffix: '.min', extname: '.css' }))
    .pipe(dest(paths.build.css))
    .pipe(browserSync.reload({ stream: true }));
}

// getJsEntries
function getJsEntries() {
  const files = glob.sync(nodePath.join(srcPath, 'assets/js/**/*.js'))
    .filter(file => !file.endsWith('.min.js'));
  return files.reduce((entries, file) => {
    // получаем «путь/до/файла» без расширения
    const name = nodePath
      .relative(nodePath.join(srcPath, 'assets/js'), file)
      .replace(/\.js$/, '');
    entries[name] = nodePath.resolve(file);
    return entries;
  }, {});
}

// JS
function js() {
  const entries = getJsEntries();
  return webpackStream({
    mode: 'production',
    entry: entries,
    module: {
      rules: [
        {
          test: /\.m?js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: { presets: ['@babel/preset-env'] }
          }
        }
      ]
    },
    resolve: {
      extensions: ['.js'],
      modules: [nodePath.resolve(__dirname, 'node_modules'), 'node_modules']
    },
    externals: {
      '@gltf-transform/core': 'commonjs @gltf-transform/core',
      '@gltf-transform/extensions': 'commonjs @gltf-transform/extensions',
      '@gltf-transform/functions': 'commonjs @gltf-transform/functions',
      'draco3dgltf': 'commonjs draco3dgltf'
    },
    output: { filename: '[name].min.js' },
    performance: {
      hints: "warning"
    }
  }, webpack)
    .pipe(dest(paths.build.js))
    .pipe(browserSync.reload({ stream: true }));
}

// JS Watch
function jsWatch() {
  const entries = getJsEntries();
  return webpackStream({
    mode: 'development',
    entry: entries,
    module: {
      rules: [
        {
          test: /\.m?js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: { presets: ['@babel/preset-env'] }
          }
        }
      ]
    },
    resolve: {
      extensions: ['.js'],
      modules: [nodePath.resolve(__dirname, 'node_modules'), 'node_modules']
    },
    externals: {
      '@gltf-transform/core': 'commonjs @gltf-transform/core',
      '@gltf-transform/extensions': 'commonjs @gltf-transform/extensions',
      '@gltf-transform/functions': 'commonjs @gltf-transform/functions',
      'draco3dgltf': 'commonjs draco3dgltf'
    },
    output: { filename: '[name].min.js' },
    performance: {
      hints: false
    },
    devtool: 'inline-source-map'
  }, webpack)
    .pipe(dest(paths.build.js))
    .pipe(browserSync.reload({ stream: true }));
}

// Copy vendor minified JS without bundling
function copyJsVendor() {
  return src(`${srcPath}assets/js/**/*.min.js`, { base: `${srcPath}assets/js/` })
    .pipe(dest(paths.build.js))
    .pipe(browserSync.reload({ stream: true }));
}

// Images
function images() {
  return src(paths.src.images)
    .pipe(image({ concurrent: 5 }))
    .pipe(dest(paths.build.images))
    .pipe(browserSync.reload({ stream: true }));
}

// Favicon
function favicon() {
  return src('src/assets/images/favicon.*')
    .pipe(dest('dist/'));
}

// Fonts
function fonts() {
  return src(paths.src.fonts)
    .pipe(dest(paths.build.fonts))
    .pipe(browserSync.reload({ stream: true }));
}

// Clean
function clean() {
  return del(paths.clean);
}

// Watch Files
function watchFiles(done) {
  watch(paths.watch.html, html);
  watch(paths.watch.css, cssWatch);
  watch(paths.watch.js, jsWatch);
  watch(`${srcPath}assets/js/**/*.min.js`, copyJsVendor);
  watch(paths.watch.images, images);
  watch(paths.watch.fonts, fonts);
  done();
}

// Build & Dev
const build = series(
  clean,
  parallel(html, css, js, copyJsVendor, images, favicon, fonts)
);
const dev = series(build, parallel(serve, watchFiles));

// Exports
export { html, css, js, copyJsVendor, images, favicon, fonts, clean, build };
export { dev as watch };
export default dev;
