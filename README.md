# perf_tool_ftv

The project is a tool to measure time performance for Firetv app.

## Setup

Set variables in `.env` file

```shell
PACKAGE="{your package id}"
MAIN_ACTIVITY="{your main activity path}"
```

Install the right node version. See [./nvmrc] to understand the right version. Usually we use [nvm](https://github.com/nvm-sh/nvm).

```shell
nvm i
```

Install dependencies

```shell
pnpm i
```

Connect to device to measure perf.
Please follow this [guide](https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html)

```shell
adb connect {ip:5555}
```

### Build script

```shell
pnpm build
```

### Run script

```shell
pnpm start
```
