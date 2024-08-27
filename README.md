# perf_tool_ftv

The project is a tool to measure time performance for Firetv app based on these guides:

- [app-performance-scripts](https://developer.amazon.com/docs/app-testing/app-performance-scripts.html)
- [test-criteria](https://developer.amazon.com/docs/app-testing/test-criteria.html)

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
adb connect {device_ip}:5555
```

## Build script

```shell
pnpm build
```

## Run script

```shell
pnpm start
```

## Features

- [ ] [Warm Iterations](https://developer.amazon.com/docs/app-testing/app-performance-scripts.html#warm-iterations)
- [ ] [Memory KPI](https://developer.amazon.com/docs/app-testing/app-performance-scripts.html#memory-kpi)
