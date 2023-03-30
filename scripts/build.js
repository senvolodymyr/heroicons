const fs = require('fs').promises
const camelcase = require('camelcase')
const { promisify } = require('util')
const rimraf = promisify(require('rimraf'))
const svgr = require('@svgr/core').default
const babel = require('@babel/core')
const { dirname } = require('path')

let transform = {
  icons: async (svg, componentName, format) => {
    let component = await svgr(svg, { ref: true, titleProp: true }, { componentName })
    let { code } = await babel.transformAsync(component, {
      plugins: [[require('@babel/plugin-transform-react-jsx'), { useBuiltIns: true }]],
    })

    if (format === 'esm') {
      return code
    }

    return code
      .replace('import * as React from "react"', 'const React = require("react")')
      .replace('export default', 'module.exports =')
  },
}

async function getIcons(style) {
  let files = await fs.readdir(`./optimized/${style}`)
  return Promise.all(
    files.map(async (file) => ({
      svg: await fs.readFile(`./optimized/${style}/${file}`, 'utf8'),
      componentName: `${camelcase(file.replace(/\.svg$/, ''), {
        pascalCase: true,
      })}Icon`,
    }))
  )
}

function exportAll(icons, format, includeExtension = true) {
  return icons
    .map(({ componentName }) => {
      let extension = includeExtension ? '.js' : ''
      if (format === 'esm') {
        return `export { default as ${componentName} } from './${componentName}${extension}'`
      }
      return `module.exports.${componentName} = require("./${componentName}${extension}")`
    })
    .join('\n')
}

async function ensureWrite(file, text) {
  await fs.mkdir(dirname(file), { recursive: true })
  await fs.writeFile(file, text, 'utf8')
}

async function ensureWriteJson(file, json) {
  await ensureWrite(file, JSON.stringify(json, null, 2))
}

async function buildIcons(package, style, format) {
  let outDir = `./${package}/${style}`
  if (format === 'esm') {
    outDir += '/esm'
  }

  let icons = await getIcons(style)

  await Promise.all(
    icons.flatMap(async ({ componentName, svg }) => {
      let content = await transform[package](svg, componentName, format)
      let types = `import * as React from 'react';\ndeclare const ${componentName}: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & { title?: string, titleId?: string }>;\nexport default ${componentName};\n`

      return [
        ensureWrite(`${outDir}/${componentName}.js`, content),
        ...(types ? [ensureWrite(`${outDir}/${componentName}.d.ts`, types)] : []),
      ]
    })
  )

  await ensureWrite(`${outDir}/index.js`, exportAll(icons, format))

  await ensureWrite(`${outDir}/index.d.ts`, exportAll(icons, 'esm', false))
}

/**
 * @param {string[]} styles
 */
async function buildExports(styles) {
  let pkg = {}

  // To appease Vite's optimizeDeps feature which requires a root-level import
  pkg[`.`] = {
    import: `./index.esm.js`,
    require: `./index.js`,
  }

  // For those that want to read the version from package.json
  pkg[`./package.json`] = { "default": "./package.json" }

  // Backwards compatibility with v1 imports (points to proxy that prints an error message):
  pkg["./outline"] = { "default": "./outline/index.js" }
  pkg["./outline/index"] = { "default": "./outline/index.js" }
  pkg["./outline/index.js"] = { "default": "./outline/index.js" }

  // Explicit exports for each style:
  for (let style of styles) {
    pkg[`./${style}`] = {
      "types": `./${style}/index.d.ts`,
      "import": `./${style}/index.js`,
      "require": `./${style}/index.js`
    }
    pkg[`./${style}/*`] = {
      "types": `./${style}/*.d.ts`,
      "import": `./${style}/esm/*.js`,
      "require": `./${style}/*.js`
    }
    pkg[`./${style}/*.js`] = {
      "types": `./${style}/*.d.ts`,
      "import": `./${style}/esm/*.js`,
      "require": `./${style}/*.js`
    }

    // This dir is basically an implementation detail, but it's needed for
    // backwards compatibility in case people were importing from it directly.
    pkg[`./${style}/esm/*`] = {
      "types": `./${style}/*.d.ts`,
      "import": `./${style}/esm/*.js`
    }
    pkg[`./${style}/esm/*.js`] = {
      "types": `./${style}/*.d.ts`,
      "import": `./${style}/esm/*.js`
    }
  }

  return pkg
}

async function main(package) {
  const cjsPackageJson = { module: './esm/index.js', sideEffects: false }
  const esmPackageJson = { type: 'module', sideEffects: false }

  console.log(`Building ${package} package...`)

  await Promise.all([
    rimraf(`./${package}/24/outline/*`),
  ])

  await Promise.all([
    buildIcons(package, '24/outline', 'cjs'),
    buildIcons(package, '24/outline', 'esm'),
    ensureWriteJson(`./${package}/24/outline/esm/package.json`, esmPackageJson),
    ensureWriteJson(`./${package}/24/outline/package.json`, cjsPackageJson),
  ])

  let packageJson = JSON.parse(await fs.readFile(`./${package}/package.json`, 'utf8'))

  packageJson.exports = await buildExports([
    '24/outline',
  ])

  await ensureWriteJson(`./${package}/package.json`, packageJson)

  return console.log(`Finished building ${package} package.`)
}

let [package] = process.argv.slice(2)

if (!package) {
  throw new Error('Please specify a package')
}

main(package)
