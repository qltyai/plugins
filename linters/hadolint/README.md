# Hadolint

[Hadolint](https://github.com/hadolint/hadolint) is a Dockerfile linter written in Haskell.

## Enabling the Hadolint plugin

Enabling with the `qlty` CLI:

```bash
qlty plugins enable hadolint
```

Or by editing `qlty.toml`:

```toml
[plugins.enabled]
hadolint = "latest"
```

## Configuration files

- [`.hadolint.yaml`](https://github.com/hadolint/hadolint?tab=readme-ov-file#configure)

## License

[GNU General Public License v3.0](https://github.com/hadolint/hadolint/blob/master/LICENSE)
