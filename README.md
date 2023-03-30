## Usage

First, install `@buywith/icons` from npm:

```sh
yarn add @buywith/icons
```

Now each icon can be imported individually as a React component:

```js
import { BellIcon } from '@buywith/icons/24/solid';

function MyComponent() {
  return (
    <div>
      <BellIcon className="h-6 w-6 text-blue-500" />
      <p>...</p>
    </div>
  );
}
```

Icons use an upper camel case naming convention and are always suffixed with the word `Icon`.

## Add new icons

Currently only solid and 24px-sized icons are supported.

1) Add new icons to the `src` directory to the correct set (src/24/outline/ in our case)
2) (Optionally) Format svg icons using `prettier`
```sh
yarn prettify
```
3) Build the new icons set
```sh
yarn build
```
4) Update the remote repository

## License

This library is MIT licensed.
