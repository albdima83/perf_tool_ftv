import { exec } from "child_process";
import dotenv from "dotenv";
import * as fs from "fs";
import readline from "node:readline";
/**
 * Load env variables
 */
dotenv.config();

/**
 * PACKAGE APP AND MAIN ACTIVITY
 */
const PACKAGE = process.env.PACKAGE;
const MAIN_ACTIVITY = process.env.MAIN_ACTIVITY;
const LAUNCH_APPLICATION = `${PACKAGE}/${MAIN_ACTIVITY}`;

/**
 * SEARCH TEXT FOR TIME
 */
const SEARCH_TXT_DISPLAYED_APP = `Displayed ${LAUNCH_APPLICATION}`;
const SEARCH_TXT_FULLY_DRAWN_APP = `Fully drawn ${LAUNCH_APPLICATION}`;
const SEARCH_ACTIVITIES_RUN = "Run #";
const SEARCH_ACTIVITIES_RUN_ANDROID_MAJOR_29 = "Hist #";

/**
 * COOL APP LAUNCH TIME
 */
const COOL_APP = "cool_app_launch_time";
const COOL_ACTIVITY = "cool_activity_launch_time";
const AM_ACTIVITY_LAUNCH_TIME = "am_activity_launch_time:";
const WM_ACTIVITY_LAUNCH_TIME = "wm_activity_launch_time:";
const WARM_ACTIVITY_LAUNCH_TIME = "performance:warm_activity_launch_time:";
/**
 * WARM APP
 */
const WARM_APP_WARM = "warm_app_warm_transition_launch_time";
const WARM_APP_COOL = "warm_app_cool_transition_launch_time";
const AM_FULLY_DRAWN = "am_activity_fully_drawn_time:";
const WM_FULLY_DRAWN = "wm_activity_fully_drawn_time:";
/**
 * LOG CSV
 */
const VALUES_ROW_SEPARATOR = "\t";
const LINE_SEPARATOR = "\n";

/**
 * NUMBER ITERACTIONS to capture data
 */
const NUMBER_OF_ITERACTION = process.env.NUMBER_OF_ITERACTION
	? parseInt(process.env.NUMBER_OF_ITERACTION)
	: 50;

/**
 * Interfaces
 */
interface DeviceInfo {
	model: string;
	serialNumber: string;
	androidVersion: string;
	androidSdk: string;
	productName: string;
	appVersion: string;
}

interface TimeMeasure {
	time: number;
	line: string | undefined;
}

/**
 * Function to create prompt interface
 */
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (query: string): Promise<string> => new Promise((resolve) => rl.question(query, resolve));

/**
 * Print log with custom tag
 */
function printLog(message: string, args?: string[] | undefined): void {
	console.log("🐝", message, args);
}

/**
 * Execute shell command
 */
function execShellCommand(command: string, args?: string[] | undefined): Promise<string> {
	return new Promise((resolve, reject) => {
		const cmds = args ?? [];
		cmds.unshift(command);
		const cmd = cmds.join(" ");
		printLog(`Execute command: [${cmd}]`);
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(stdout.trim());
		});
	});
}

/**
 * Retrieve a device list devices
 */
async function getDeviceList(): Promise<Array<string>> {
	const devices = await execShellCommand("adb", ["devices | awk 'NR>1 && $2==\"device\" {print $1}'"]);
	if (devices) {
		return devices.split(/\r?\n/);
	}
	return [];
}

/**
 * Call an adb command with a specific device and commands
 */
async function adbDevice(device: string, commands?: Array<string> | undefined): Promise<string> {
	return await execShellCommand("adb", ["-s", device, ...(commands || [])]);
}

/**
 * Call an adb shell command with a specific device and commands
 */
async function adbShellDevice(device: string, commands?: Array<string> | undefined): Promise<string> {
	return await adbDevice(device, ["shell", ...(commands || [])]);
}

/**
 * Get Adb get Props with a specific device
 */
async function adbGetProps(device: string, prop: string) {
	return await adbShellDevice(device, ["getprop", prop]);
}

/**
 * Launch application on specific device
 */
async function launchActivity(device: string): Promise<string> {
	return await adbShellDevice(device, ["am start", LAUNCH_APPLICATION]);
}

/**
 * Retrieve all running apps on specific device and appRunningSearch
 * for android_sdk > 29 appRunningSearch=[Hist #]
 * for android_sdk <= 29 appRunningSearch=[Run #]
 */
async function getRunningApps(device: string, appRunningSearch: string): Promise<Array<string>> {
	const appsString = await adbShellDevice(device, [
		`dumpsys activity | grep '${appRunningSearch}' | awk '{print $5}' | cut -d '/' -f 1`,
	]);

	if (appsString) {
		return appsString.split(/\r?\n/);
	}
	return [];
}

/**
 * Clear all running apps on specific device and appRunningSearch
 * for android_sdk > 29 appRunningSearch=[Hist #]
 * for android_sdk <= 29 appRunningSearch=[Run #]
 */
async function clearRunningApps(device: string, appRunningSearch: string) {
	const runningApps = await getRunningApps(device, appRunningSearch);
	for (const app of runningApps) {
		console.log(app);
		try {
			await adbShellDevice(device, ["am force-stop", app]);
		} catch (ex) {}
	}
}

/**
 * Clear logcat to retrieve data for next measurements
 */
async function clearLogcat(device: string) {
	try {
		await adbDevice(device, [`logcat -c`]);
		await adbShellDevice(device, [`logcat -v threadtime -b all -c`]);
	} catch (ex) {}
}

/**
 * Read logcat to retrieve data for next measurements
 */
async function readLogcat(device: string) {
	return await adbShellDevice(device, [`logcat -v threadtime -b all -d`]);
}

/**
 * Sleep function like bash
 */
async function sleep(time: number) {
	return new Promise((resolve) => setTimeout(resolve, time));
}

/**
 * Retrieve device info
 * @return @type DeviceInfo
 */
async function getInfoDevice(device: string): Promise<DeviceInfo> {
	const model = await adbGetProps(device, "ro.product.model");
	const serialNumber = await adbGetProps(device, "ro.serialno");
	const androidVersion = await adbGetProps(device, "ro.build.version.release");
	const androidSdk = await adbGetProps(device, "ro.build.version.sdk");
	const productName = await adbGetProps(device, "ro.product.name");
	const appVersion = await adbShellDevice(device, [
		`dumpsys package ${PACKAGE} | grep versionName | awk -F= '{print $2}'`,
	]);

	return {
		model,
		serialNumber,
		androidVersion,
		androidSdk,
		productName,
		appVersion,
	};
}

/**
 * Get Display Time
 * @link https://developer.amazon.com/docs/app-testing/app-performance-scripts.html
 * @returns @type TimeMeasure
 */

function getDisplayedTime(file: string): TimeMeasure {
	const lines = file.split(/\r?\n/);
	let value = 0;
	try {
		for (const l of lines) {
			if (
				(l && l.includes(`key=${PACKAGE}`) && l.includes(AM_ACTIVITY_LAUNCH_TIME)) ||
				l.includes(WM_ACTIVITY_LAUNCH_TIME) ||
				l.includes(WARM_ACTIVITY_LAUNCH_TIME)
			) {
				try {
					const timeStr = l.split("]")[0].split("\\[")[1];
					if (!isNaN(parseFloat(timeStr))) {
						value = parseFloat(timeStr);
						return {
							time: value,
							line: l,
						};
					}
				} catch (e) {}
			}
		}
	} catch (ex) {
		console.error(ex);
	}

	return { time: 0, line: undefined };
}

/**
 * Get Vital Time
 * @link https://developer.amazon.com/docs/app-testing/app-performance-scripts.html
 * @returns @type TimeMeasure
 */
function getVitalsTime(file: string, metricSearch: string): TimeMeasure {
	const lines = file.split(/\r?\n/);
	let value = 0;
	try {
		for (const l of lines) {
			if (
				l &&
				l.includes(`key=${PACKAGE}`) &&
				l.includes(`performance:${metricSearch}`) &&
				l.includes("Timer=")
			) {
				try {
					const timeStr = l.split("Timer=")[1].split(";")[0];
					if (!isNaN(parseFloat(timeStr))) {
						value = parseFloat(timeStr);
						return {
							time: value,
							line: l,
						};
					}
				} catch (e) {}
			}
		}
	} catch (ex) {
		console.error(ex);
	}

	return {
		time: 0,
		line: undefined,
	};
}

/**
 * Get Search text in line
 * @link https://developer.amazon.com/docs/app-testing/test-criteria.html
 * @returns string | undefined
 */
function getSearchTxt(file: string, metricSearch: string): string | undefined {
	const lines = file.split(/\r?\n/);
	try {
		for (const line of lines) {
			if (line && line.includes(metricSearch)) {
				return line;
			}
		}
	} catch (ex) {
		console.error(ex);
	}

	return undefined;
}

/**
 * Write row data on file
 * @param fileName
 * @param arrayData
 */
function writeRowData(fileName: string, arrayData: Array<unknown>) {
	const data = arrayData.join(VALUES_ROW_SEPARATOR) + LINE_SEPARATOR;
	fs.writeFileSync(fileName, data, { flag: "a+" });
}

/**
 * Application Main
 */
async function main() {
	let device = null;
	if (!PACKAGE || !MAIN_ACTIVITY) {
		printLog("Please set configuration on .env file");
		printLog("Follow 'Setup' on Readme.md");
		return;
	}
	//retrieve a list of all devices connected by adb
	const devices = await getDeviceList();
	if (devices.length === 0) {
		printLog("Empty devices. Please check the connection...");
		return;
	}
	device = devices[0];
	if (devices.length > 1) {
		console.log("----------------------------");
		console.log("Choose one of these devices");
		console.log("----------------------------");
		for (let i = 0; i < devices.length; i++) {
			console.log(`${i}] ${devices[i]}`);
		}
		console.log("----------------------------");
		const pt = await prompt("Please enter the number to select device: ");
		const select = parseInt(pt);
		rl.close();
		device = devices[select];
	}
	const appInfo = await getInfoDevice(device);
	const appRunningSearch =
		parseInt(appInfo.androidSdk) > 29 ? SEARCH_ACTIVITIES_RUN_ANDROID_MAJOR_29 : SEARCH_ACTIVITIES_RUN;
	//save logfile on tmp folder
	const logFile = `/tmp/${Date.now()}_measure_cool_start_${appInfo.model}_${appInfo.appVersion}.log`;
	//write device info
	writeRowData(logFile, [
		appInfo.model,
		appInfo.productName,
		appInfo.productName,
		appInfo.appVersion,
		appInfo.androidSdk,
		appInfo.androidVersion,
	]);
	//write header table
	writeRowData(logFile, ["TIME", "TIME LOG LINE", "DISPLAYED APP LINE", "FULLY DRAWN LINE"]);
	let avgTime = 0;
	for (let i = 0; i < NUMBER_OF_ITERACTION; i++) {
		//stop all applications
		await clearRunningApps(device, appRunningSearch);
		//clear all logcat
		await clearLogcat(device);
		await launchActivity(device);
		//wait 10 secs to capture data
		await sleep(10 * 1000);
		//read logcat
		const file = await readLogcat(device);
		let calcTime = 0;
		let timeRowLine: string | undefined = undefined;
		let { time, line } = getDisplayedTime(file);
		if (time > 0) {
			timeRowLine = line;
			calcTime = time;
		} else {
			let { time, line } = getVitalsTime(file, COOL_APP);
			if (time > 0) {
				timeRowLine = line;
				calcTime = time;
			} else {
				let { time, line } = getVitalsTime(file, COOL_ACTIVITY);
				if (time > 0) {
					timeRowLine = line;
					calcTime = time;
				}
			}
		}
		const displayedApp = await getSearchTxt(file, SEARCH_TXT_DISPLAYED_APP);
		const fullyDrawn = await getSearchTxt(file, SEARCH_TXT_FULLY_DRAWN_APP);
		//write data times
		writeRowData(logFile, [calcTime, timeRowLine, displayedApp, fullyDrawn]);
		//update avg time
		avgTime = avgTime + calcTime;
		//clear all logcat
		await clearLogcat(device);
		//wait 10 secs to re-iterate
		await sleep(10 * 1000);
	}
	avgTime = avgTime / NUMBER_OF_ITERACTION;
	writeRowData(logFile, ["AVG_TIME", avgTime]);
	printLog("Successfully completed!!!");
}

main().catch((ex) => console.error(ex));
