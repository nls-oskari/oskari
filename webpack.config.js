const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const OskariConfig = require('./webpack/config.js');
const parseParams = require('./webpack/parseParams.js');
const { lstatSync, readdirSync } = require('fs');
const generateEntries = require('./webpack/generateEntries.js');
const { NormalModuleReplacementPlugin } = require('webpack');

const proxyPort = 8081;

module.exports = (env, argv) => {
    const isProd = argv.mode === 'production';

    const { version, pathParam, publicPathPrefix, theme } = parseParams(env);

    const isDirectory = source => lstatSync(source).isDirectory();
    const getDirectories = source => readdirSync(source).map(name => path.join(source, name)).filter(isDirectory);
    const appsetupPaths = getDirectories(path.resolve(pathParam));

    const { entries, plugins } = generateEntries(appsetupPaths, isProd, __dirname);
    plugins.push(new MiniCssExtractPlugin({
        filename: '[name]/oskari.min.css'
    }));

    // Replace ant design global styles with a custom solution to prevent global styles affecting the app.
    const replacement = path.join(__dirname, 'src/react/ant-globals.less');
    plugins.push(new NormalModuleReplacementPlugin(/..\/..\/style\/index\.less/, replacement));

    const themeFile = theme ? path.resolve(theme) : path.join(__dirname, 'src/react/ant-theme.less');

    // Common config for both prod & dev
    const config = {
        node: {
            fs: 'empty'
        },
        mode: isProd ? 'production' : 'development',
        entry: entries,
        devtool: isProd ? 'source-map' : 'cheap-module-eval-source-map',
        output: {
            path: path.resolve(`dist/${version}/`),
            publicPath: `${publicPathPrefix}Oskari/dist/${version}/`,
            filename: '[name]/oskari.min.js'
        },
        module: {
            rules: OskariConfig.getModuleRules(isProd, themeFile)
        },
        plugins,
        resolveLoader: OskariConfig.RESOLVE_LOADER,
        resolve: OskariConfig.RESOLVE
    };

    // Mode specific config
    if (isProd) {
        config.optimization = {
            minimizer: [
                new TerserPlugin({
                    cache: true,
                    parallel: true,
                    sourceMap: true, // Must be set to true if using source-maps in production
                    terserOptions: {
                    // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions
                    }
                }),
                new OptimizeCSSAssetsPlugin({})
            ]
        };
    } else {
        config.devServer = {
            port: proxyPort,
            proxy: [{
                context: ['/transport/cometd'],
                target: 'ws://localhost:8080',
                secure: false,
                changeOrigin: true,
                ws: true
            }, {
                context: ['**', `!/Oskari/dist/${version}/**`, '!/Oskari/bundles/bundle.js'],
                target: 'http://localhost:8080',
                secure: false,
                changeOrigin: true,
                headers: {
                    'X-Forwarded-Host': 'localhost:' + proxyPort,
                    'X-Forwarded-Proto': 'http'
                }
            }]
        };
    }

    return config;
};
