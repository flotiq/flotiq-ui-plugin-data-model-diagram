import chalk from 'chalk';
import * as esbuild from 'esbuild';
import eslint from 'esbuild-plugin-eslint';
import inlineImportPlugin from 'esbuild-plugin-inline-import';
import url from 'postcss-url';
import postcss from 'postcss';

import http from 'node:http';
import https from 'node:https';
import fs from 'fs';

const watch = process.argv.includes('--watch');

function formatDuration(seconds) {
  const time = {
      y: 31536000,
      d: 86400,
      h: 3600,
      m: 60,
      s: 1,
      ms: 0.001,
    },
    res = [];

  if (seconds === 0) return 'now';

  for (let key in time) {
    if (seconds >= time[key]) {
      let val = Math.floor(seconds / time[key]);
      res.push((val += key));
      seconds = seconds % time[key];
    }
  }

  return res.length > 1
    ? res.join(', ').replace(/,([^,]*)$/, ' and' + '$1')
    : res[0];
}

function postCssTransformer(code, path) {
  return new Promise((resolve, reject) => {
    postcss([
      url({
        url: 'inline',
      }),
    ])
      .process(code, { from: path })
      .then((result) => {
        resolve(result.css);
      })
      .catch(reject);
  });
}

const context = await esbuild.context({
  entryPoints: ['plugins/index.jsx'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: 'dist/index.js',

  plugins: [
    // Write dist/plugin-manifest.json. In dev (watch) mode it points at the local bundle, so the plugin can be
    // installed from https://localhost:3053/plugin-manifest.json; the production build keeps the GitHub Pages URL.
    {
      name: 'plugin-manifest',
      setup(build) {
        build.onEnd(() => {
          const manifest = JSON.parse(
            fs.readFileSync('./plugin-manifest.json', 'utf8'),
          );
          if (watch) manifest.url = 'https://localhost:3053/index.js';
          fs.mkdirSync('dist', { recursive: true });
          fs.writeFileSync(
            'dist/plugin-manifest.json',
            JSON.stringify(manifest, null, 2),
          );
        });
      },
    },

    inlineImportPlugin({
      transform: (code, { path }) => {
        if (path.endsWith('.css')) {
          return postCssTransformer(code, path);
        }
        return code;
      },
    }),

    eslint({
      throwOnError: !watch,
    }),
    {
      name: 'result-message-plugin',
      setup(build) {
        let startedAt = null;
        build.onStart(() => {
          startedAt = Date.now();
          console.log('Build started');
        });
        build.onEnd((result) => {
          const duration = Date.now() - startedAt;
          const durationText = formatDuration(duration / 1000);
          console.log(
            'Build ended after',
            duration > 1000
              ? chalk.red(durationText)
              : chalk.green(durationText),
          );
          const errors = result?.errors?.length || 0;
          const warnings = result?.warnings?.length || 0;
          if (result?.errors?.length) {
            console.log(chalk.red('Failed. See errors above for details.'));
          } else {
            console.log(chalk.green('Success'));
          }
          if (errors || warnings) {
            console.log(
              `Errors/Warnings: ${errors ? chalk.red(errors) : errors}/${
                warnings ? chalk.yellow(warnings) : warnings
              }`,
            );
          }
        });
      },
    },
  ],
});

if (watch) {
  console.log('Watching for changes...');
  context.watch();

  const { hosts, port } = await context.serve({
    servedir: 'dist',
    port: 3050,
  });
  const host = hosts[0];

  const headers = {
    'access-control-allow-origin': '*' /* @dev First, read about security */,
    'access-control-allow-methods': 'OPTIONS, POST, GET',
    'access-control-max-age': 2592000, // 30 days
    'access-control-allow-headers': '*',
    /** add other headers as per requirement */
  };

  const options = {
    key: fs.readFileSync('./.dev/localhost.key'),
    cert: fs.readFileSync('./.dev/localhost.cert'),
  };

  // Then start a proxy server on port 3000
  https
    .createServer(options, (req, res) => {
      const options = {
        hostname: host,
        port: port,
        path: req.url,
        method: req.method,
        headers: req.headers,
      };

      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
      }

      // Forward each incoming request to esbuild
      const proxyReq = http.request(options, (proxyRes) => {
        // Forward the response from esbuild to the client
        // Include CORS headers
        res.writeHead(proxyRes.statusCode, {
          ...proxyRes.headers,
          ...headers,
        });
        proxyRes.pipe(res, { end: true });
      });

      // Forward the body of the request to esbuild
      req.pipe(proxyReq, { end: true });
    })
    .listen(3053);

  console.log(
    `Serving at http://${host.replace(
      '127.0.0.1',
      'localhost',
    )}:${port}/index.js and https://${host.replace(
      '127.0.0.1',
      'localhost',
    )}:${3053}/index.js`,
  );

  console.log(
    `Manifest file is available at http://${host.replace(
      '127.0.0.1',
      'localhost',
    )}:${port}/plugin-manifest.json and https://${host.replace(
      '127.0.0.1',
      'localhost',
    )}:${3053}/plugin-manifest.json`,
  );
} else {
  await context.rebuild();
  context.dispose();
}
