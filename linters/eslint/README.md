# Eslint

[Eslint](https://github.com/eslint/eslint) tool for identifying and reporting on patterns found in ECMAScript/JavaScript code.

## Enabling Eslint

Enabling with the `qlty` CLI:

```bash
qlty plugins enable eslint
```

Or by editing `qlty.toml`:

```toml
# Always use the latest version
[plugins.enabled]
eslint = "latest"

# OR enable a specific version
[plugins.enabled]
eslint = "X.Y.Z"
```

## Auto-enabling

Eslint will be automatically enabled by `qlty init` if a `.eslintrc` configuration file is present.

## Configuration files

- [`.eslintrc`](https://eslint.org/docs/latest/use/configure/configuration-files)

To keep your project tidy, you can move configuration files into `.qlty/configs` and Qlty will find and use them when running Eslint.

## Links

- [Eslint on GitHub](https://github.com/eslint/eslint)
- [Eslint plugin definition](https://github.com/qltyai/plugins/tree/main/linters/eslint)
- [Eslint releases](https://github.com/eslint/eslint/releases)
- [Qlty's open source plugin definitions](https://github.com/qltyai/plugins)

## License

Eslint is licensed under the [MIT license](https://github.com/eslint/eslint/blob/main/LICENSE).
