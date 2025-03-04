let backupIntervalRunning = false;
let wasImportSuccessful = false;
const TIME_BACKUP_INTERVAL = 15;
const TIME_BACKUP_FILE_PREFIX = `T-${TIME_BACKUP_INTERVAL}`;

(async function checkDOMOrRunBackup() {
	if (document.readyState === 'complete') {
		await handleDOMReady();
	} else {
		window.addEventListener('load', handleDOMReady);
	}
})();

async function handleDOMReady() {
	window.removeEventListener('load', handleDOMReady);
	var importSuccessful = await checkAndImportBackup();
	const storedSuffix = localStorage.getItem('last-daily-backup-in-s3');
	const today = new Date();
	const currentDateSuffix = `${today.getFullYear()}${String(
		today.getMonth() + 1
	).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
	const currentTime = new Date().toLocaleString();
	const lastSync = localStorage.getItem('last-cloud-sync');
	var element = document.getElementById('last-sync-msg');

	if (lastSync && importSuccessful) {
		if (element !== null) {
			element.innerText = `Last sync done at ${currentTime}`;
			element = null;
		}
		if (!storedSuffix || currentDateSuffix > storedSuffix) {
			await handleBackupFiles();
		}
		startBackupInterval();
	} else if (!backupIntervalRunning) {
		startBackupInterval();
	}
}

// Create a new button
const cloudSyncBtn = document.createElement('button');
cloudSyncBtn.setAttribute('data-element-id', 'cloud-sync-button');
cloudSyncBtn.className =
	'cursor-default group flex items-center justify-center p-1 text-sm font-medium flex-col group focus:outline-0 focus:text-white text-white/70';

const cloudIconSVG = `
<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 6400 5120" class="h-6 w-6 flex-shrink-0" aria-hidden="true" height="10em" width="10em" xmlns="http://www.w3.org/2000/svg"><path d="M5120 2240c0 -707 -573 -1280 -1280 -1280 -112 0 -220 15 -325 40C3380 622 3020 360 2620 360c-625 0 -1340 715 -1340 1560 0 123 15 242 43 355C745 2343 0 3035 0 3840c0 707 573 1280 1280 1280h3840c707 0 1280 -573 1280 -1280s-573 -1280 -1280 -1280zm0 1920"/></svg>
`;

const textSpan = document.createElement('span');
textSpan.className = 'text-[11px]';
textSpan.innerText = 'Backup';

const iconSpan = document.createElement('span');
iconSpan.className =
	'block group-hover:bg-white/30 w-[35px] h-[35px] transition-all rounded-lg flex items-center justify-center group-hover:text-white/90';
iconSpan.innerHTML = cloudIconSVG;

cloudSyncBtn.appendChild(iconSpan);
cloudSyncBtn.appendChild(textSpan);

function insertCloudSyncButton() {
	const teamsButton = document.querySelector(
		'[data-element-id="workspace-tab-teams"]'
	);

	if (teamsButton && teamsButton.parentNode) {
		teamsButton.parentNode.insertBefore(cloudSyncBtn, teamsButton.nextSibling);
		return true;
	}
	return false;
}

const observer = new MutationObserver((mutations) => {
	if (insertCloudSyncButton()) {
		observer.disconnect();
	}
});

observer.observe(document.body, {
	childList: true,
	subtree: true,
});

const maxAttempts = 10;
let attempts = 0;
const interval = setInterval(() => {
	if (insertCloudSyncButton() || attempts >= maxAttempts) {
		clearInterval(interval);
	}
	attempts++;
}, 1000);

// Attach modal to new button
cloudSyncBtn.addEventListener('click', function () {
	openSyncModal();
});

// New Popup
let lastBackupTime = 0;
let isExportInProgress = false;
let backupInterval;

function openSyncModal() {
	var existingModal = document.querySelector(
		'div[data-element-id="sync-modal-dbbackup"]'
	);
	if (existingModal) {
		return;
	}
	var modalPopup = document.createElement('div');
	modalPopup.style.paddingLeft = '10px';
	modalPopup.style.paddingRight = '10px';
	modalPopup.setAttribute('data-element-id', 'sync-modal-dbbackup');
	modalPopup.className =
		'bg-opacity-75 fixed inset-0 bg-gray-800 transition-all flex items-center justify-center z-[60]';
	modalPopup.innerHTML = `
        <div class="inline-block w-full align-bottom bg-white dark:bg-zinc-950 rounded-lg px-4 pb-4 text-left shadow-xl transform transition-all sm:my-8 sm:p-6 sm:align-middle pt-4 overflow-hidden sm:max-w-lg">
            <div class="text-gray-800 dark:text-white text-left text-sm">
                <div class="flex justify-center items-center mb-4">
                    <h3 class="text-center text-xl font-bold">Backup & Sync</h3>
                    <div class="relative group ml-2">
                        <span class="cursor-pointer" id="info-icon" style="color: white">ℹ</span>
                        <div id="tooltip" style="display:none; width: 250px; margin-top: 0.5em;" class="z-1 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded-md px-2 py-1 opacity-90 transition-opacity duration-300 opacity-0 transition-opacity">
                            Fill form & Save. If you are using Amazon S3 - fill in S3 Bucket Name, AWS Region, AWS Access Key, AWS Secret Key.<br/><br/> Initial backup: You will need to click on "Export to S3" to create your first backup in S3. Thereafter, automatic backups are done to S3 every 1 minute if the browser tab is active.<br/><br/> Restore backup: If S3 already has an existing backup, this extension will automatically pick it and restore the data in this typingmind instance. <br/><br/> Adhoc Backup & Restore:  Use the "Export to S3" and "Import from S3" to perform on-demand backup or restore. Note that this overwrites the main backup. <br/><br/> Snapshot: Creates an instant 'no-touch' backup that will not be overwritten. <br/><br/> Download: You can select the backup data to be download and click on Download button to download it for local storage. <br/><br/> Restore: Select the backup you want to restore and Click on Restore. The typingmind data will be restored to the selected backup data/date.
                        </div>
                    </div>
                </div>
                <div class="space-y-4">
                    <div>
		    <div class="mt-6 bg-gray-100 px-3 py-3 rounded-lg border border-gray-200 dark:bg-zinc-800 dark:border-gray-600">
    <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-400">Available Backups</label>
        <button id="refresh-backups-btn" class="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
        </button>
    </div>
    <div class="space-y-2">
        <div class="w-full">
            <select id="backup-files" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700">
                <option value="">Please configure AWS credentials first</option>
            </select>
        </div>
        <div class="flex justify-end space-x-2">
            <button id="download-backup-btn" class="z-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled>
                Download
            </button>
            <button id="restore-backup-btn" class="z-1 px-3 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled>
                Restore
            </button>
        </div>
    </div>
</div>
                        <div class="my-4 bg-gray-100 px-3 py-3 rounded-lg border border-gray-200 dark:bg-zinc-800 dark:border-gray-600">
                            <div class="space-y-4">
                                <div>
                                    <label for="aws-bucket" class="block text-sm font-medium text-gray-700 dark:text-gray-400">S3 Bucket Name</label>
                                    <input id="aws-bucket" name="aws-bucket" type="text" class="z-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700" autocomplete="off" required>
                                </div>
                                <div>
                                    <label for="aws-region" class="block text-sm font-medium text-gray-700 dark:text-gray-400">AWS Region</label>
                                    <input id="aws-region" name="aws-region" type="text" class="z-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700" autocomplete="off" required>
                                </div>
                                <div>
                                    <label for="aws-access-key" class="block text-sm font-medium text-gray-700 dark:text-gray-400">AWS Access Key</label>
                                    <input id="aws-access-key" name="aws-access-key" type="password" class="z-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700" autocomplete="off" required>
                                </div>
                                <div>
                                    <label for="aws-secret-key" class="block text-sm font-medium text-gray-700 dark:text-gray-400">AWS Secret Key</label>
                                    <input id="aws-secret-key" name="aws-secret-key" type="password" class="z-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700" autocomplete="off" required>
                                </div>
                                <div>
                                    <label for="aws-endpoint" class="block text-sm font-medium text-gray-700 dark:text-gray-400">AWS/S3 compatible Storage endpoint (Optional)</label>
                                    <input id="aws-endpoint" name="aws-endpoint" type="text" class="z-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700" autocomplete="off">
                                </div>
                                <div class="flex justify-between space-x-2">
                                    <button id="save-aws-details-btn" type="button" class="z-1 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-default transition-colors" disabled>
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-between space-x-2 mt-4">
                        <button id="export-to-s3-btn" type="button" class="z-1 inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-default transition-colors" disabled>
                            <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 1024 1024" fill-rule="evenodd" class="w-4 h-4 mr-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                <path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h360c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H184V184h656v320c0 4.4-3.6 8 8 8h56c4.4 0 8-3.6 8-8V144c0-17.7-14.3-32-32-32ZM770.87 824.869l-52.2 52.2c-4.7 4.7-1.9 12.8 4.7 13.6l179.4 21c5.1.6 9.5-3.7 8.9-8.9l-21-179.4c-.8-6.6-8.9-9.4-13.6-4.7l-52.4 52.4-256.2-256.2c-3.1-3.1-8.2-3.1-11.3 0l-42.4 42.4c-3.1 3.1-3.1 8.2 0 11.3l256.1 256.3Z" transform="matrix(1 0 0 -1 0 1024)"></path>
                            </svg><span>Export to S3</span>
                        </button>
                        <button id="import-from-s3-btn" type="button" class="z-1 inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-default transition-colors" disabled>
                            <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 1024 1024" fill-rule="evenodd" class="w-4 h-4 mr-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                <path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h360c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H184V184h656v320c0 4.4-3.6 8 8 8h56c4.4 0 8-3.6 8-8V144c0-17.7-14.3-32-32-32ZM653.3 599.4l52.2-52.2c4.7-4.7 1.9-12.8-4.7-13.6l-179.4-21c-5.1-.6-9.5 3.7-8.9 8.9l21 179.4c.8 6.6 8.9 9.4 13.6 4.7l52.4-52.4 256.2 256.2c3.1 3.1 8.2 3.1 11.3 0l42.4-42.4c3.1-3.1 3.1-8.2 0-11.3L653.3 599.4Z" transform="matrix(1 0 0 -1 0 1024)"></path>
                            </svg><span>Import from S3</span>
                        </button>
                            <button id="snapshot-btn" type="button" class="z-1 inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-default transition-colors" disabled>
        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" class="w-4 h-4 mr-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1v6zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2z"/>
            <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"/>
        </svg><span>Snapshot</span>
    </button></div>

                    <!-- Status messages -->
                    <div class="text-center mt-4">
                        <span id="last-sync-msg"></span>
                    </div>
                    <div id="action-msg" class="text-center"></div>
                </div>
            </div>
        </div>`;
	document.body.appendChild(modalPopup);
	loadBackupFiles();

	const awsBucketInput = document.getElementById('aws-bucket');
	const awsRegionInput = document.getElementById('aws-region');
	const awsAccessKeyInput = document.getElementById('aws-access-key');
	const awsSecretKeyInput = document.getElementById('aws-secret-key');
	const awsEndpointInput = document.getElementById('aws-endpoint');
	const savedBucket = localStorage.getItem('aws-bucket');
	const savedRegion = localStorage.getItem('aws-region');
	const savedAccessKey = localStorage.getItem('aws-access-key');
	const savedSecretKey = localStorage.getItem('aws-secret-key');
	const savedEndpoint = localStorage.getItem('aws-endpoint');
	const lastSync = localStorage.getItem('last-cloud-sync');

	if (savedBucket) awsBucketInput.value = savedBucket;
	if (savedRegion) awsRegionInput.value = savedRegion;
	if (savedAccessKey) awsAccessKeyInput.value = savedAccessKey;
	if (savedSecretKey) awsSecretKeyInput.value = savedSecretKey;
	if (savedEndpoint) awsEndpointInput.value = savedEndpoint;
	const currentTime = new Date().toLocaleString();
	var element = document.getElementById('last-sync-msg');
	if (lastSync) {
		if (element !== null) {
			element.innerText = `Last sync done at ${currentTime}`;
			element = null;
		}
	}

	function updateButtonState() {
		const isDisabled =
			!awsBucketInput.value.trim() ||
			!awsRegionInput.value.trim() ||
			!awsAccessKeyInput.value.trim() ||
			!awsSecretKeyInput.value.trim();
		document.getElementById('export-to-s3-btn').disabled = isDisabled;
		document.getElementById('import-from-s3-btn').disabled = isDisabled;
		document.getElementById('save-aws-details-btn').disabled = isDisabled;
		document.getElementById('snapshot-btn').disabled = isDisabled;
	}

	modalPopup.addEventListener('click', function (event) {
		if (event.target === modalPopup) {
			modalPopup.remove();
		}
	});

	awsBucketInput.addEventListener('input', updateButtonState);
	awsRegionInput.addEventListener('input', updateButtonState);
	awsAccessKeyInput.addEventListener('input', updateButtonState);
	awsSecretKeyInput.addEventListener('input', updateButtonState);
	awsEndpointInput.addEventListener('input', updateButtonState);

	updateButtonState();

	const infoIcon = document.getElementById('info-icon');
	const tooltip = document.getElementById('tooltip');

	function showTooltip() {
		tooltip.style.removeProperty('display');
		tooltip.classList.add('opacity-100');
		tooltip.classList.remove('z-1');
		tooltip.classList.add('z-2');
		tooltip.classList.remove('opacity-0');
	}

	function hideTooltip() {
		tooltip.style.display = 'none';
		tooltip.classList.add('opacity-0');
		tooltip.classList.remove('z-2');
		tooltip.classList.add('z-1');
		tooltip.classList.remove('opacity-100');
	}

	infoIcon.addEventListener('click', () => {
		const isVisible = tooltip.classList.contains('opacity-100');
		if (isVisible) {
			hideTooltip();
		} else {
			showTooltip();
		}
	});

	document
		.getElementById('backup-files')
		.addEventListener('change', updateBackupButtons);
	document
		.getElementById('download-backup-btn')
		.addEventListener('click', downloadBackupFile);
	document
		.getElementById('restore-backup-btn')
		.addEventListener('click', restoreBackupFile);
	document
		.getElementById('refresh-backups-btn')
		.addEventListener('click', loadBackupFiles);

	// Save button click handler
	document
		.getElementById('save-aws-details-btn')
		.addEventListener('click', async function () {
			let extensionURLs = JSON.parse(
				localStorage.getItem('TM_useExtensionURLs') || '[]'
			);
			if (!extensionURLs.some((url) => url.endsWith('s3.js'))) {
				extensionURLs.push(
					'https://itcon-pty-au.github.io/typingmind-cloud-backup/s3.js'
				);
				localStorage.setItem(
					'TM_useExtensionURLs',
					JSON.stringify(extensionURLs)
				);
			}
			const bucketName = awsBucketInput.value.trim();
			const region = awsRegionInput.value.trim();
			const accessKey = awsAccessKeyInput.value.trim();
			const secretKey = awsSecretKeyInput.value.trim();
			const endpoint = awsEndpointInput.value.trim();

			localStorage.setItem('aws-region', region);
			localStorage.setItem('aws-endpoint', endpoint);

			try {
				await validateAwsCredentials(bucketName, accessKey, secretKey);
				localStorage.setItem('aws-bucket', bucketName);
				localStorage.setItem('aws-access-key', accessKey);
				localStorage.setItem('aws-secret-key', secretKey);
				const actionMsgElement = document.getElementById('action-msg');
				actionMsgElement.textContent = 'AWS details saved!';
				actionMsgElement.style.color = 'white';
				setTimeout(() => {
					actionMsgElement.textContent = '';
				}, 3000);
				updateButtonState();
				updateBackupButtons();
				await loadBackupFiles();
				var importSuccessful = await checkAndImportBackup();
				const currentTime = new Date().toLocaleString();
				const lastSync = localStorage.getItem('last-cloud-sync');
				var element = document.getElementById('last-sync-msg');
				if (lastSync && importSuccessful) {
					if (element !== null) {
						element.innerText = `Last sync done at ${currentTime}`;
						element = null;
					}
				}
				startBackupInterval();
			} catch (err) {
				const actionMsgElement = document.getElementById('action-msg');
				actionMsgElement.textContent = `Invalid AWS details: ${err.message}`;
				actionMsgElement.style.color = 'red';
				localStorage.setItem('aws-bucket', '');
				localStorage.setItem('aws-access-key', '');
				localStorage.setItem('aws-secret-key', '');
				clearInterval(backupInterval);
			}
		});

	// Export button click handler
	document
		.getElementById('export-to-s3-btn')
		.addEventListener('click', async function () {
			isExportInProgress = true;
			await backupToS3();
			isExportInProgress = false;
		});

	// Import button click handler
	document
		.getElementById('import-from-s3-btn')
		.addEventListener('click', async function () {
			await importFromS3();
			wasImportSuccessful = true;
		});

	// Snapshot button click handler
	// Inside openSyncModal function
	document
		.getElementById('snapshot-btn')
		.addEventListener('click', async function () {
			const now = new Date();
			const timestamp =
				now.getFullYear() +
				String(now.getMonth() + 1).padStart(2, '0') +
				String(now.getDate()).padStart(2, '0') +
				'T' +
				String(now.getHours()).padStart(2, '0') +
				String(now.getMinutes()).padStart(2, '0') +
				String(now.getSeconds()).padStart(2, '0');

			const bucketName = localStorage.getItem('aws-bucket');
			const data = await exportBackupData();
			const dataStr = JSON.stringify(data);

			try {
				// Load JSZip
				const jszip = await loadJSZip();
				const zip = new jszip();

				// Add the JSON data to the zip file
				zip.file(`Snapshot_${timestamp}.json`, dataStr, {
					compression: 'DEFLATE',
					compressionOptions: {
						level: 9,
					},
				});

				// Generate the zip content
				const compressedContent = await zip.generateAsync({ type: 'blob' });

				const s3 = new AWS.S3();
				const putParams = {
					Bucket: bucketName,
					Key: `Snapshot_${timestamp}.zip`,
					Body: compressedContent,
					ContentType: 'application/zip',
				};

				await s3.putObject(putParams).promise();

				// Update last sync message with snapshot status
				const lastSyncElement = document.getElementById('last-sync-msg');
				const currentTime = new Date().toLocaleString();
				lastSyncElement.textContent = `Snapshot successfully saved to the cloud at ${currentTime}`;

				// Revert back to regular sync status after 3 seconds
				setTimeout(() => {
					const lastSync = localStorage.getItem('last-cloud-sync');
					if (lastSync) {
						lastSyncElement.textContent = `Last sync done at ${lastSync}`;
					}
				}, 3000);
			} catch (error) {
				const lastSyncElement = document.getElementById('last-sync-msg');
				lastSyncElement.textContent = `Error creating snapshot: ${error.message}`;

				// Revert back to regular sync status after 3 seconds
				setTimeout(() => {
					const lastSync = localStorage.getItem('last-cloud-sync');
					if (lastSync) {
						lastSyncElement.textContent = `Last sync done at ${lastSync}`;
					}
				}, 3000);
			}
		});
}

// Visibility change event listener
document.addEventListener('visibilitychange', async () => {
	if (!document.hidden) {
		var importSuccessful = await checkAndImportBackup();
		const storedSuffix = localStorage.getItem('last-daily-backup-in-s3');
		const today = new Date();
		const currentDateSuffix = `${today.getFullYear()}${String(
			today.getMonth() + 1
		).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
		const currentTime = new Date().toLocaleString();
		const lastSync = localStorage.getItem('last-cloud-sync');
		var element = document.getElementById('last-sync-msg');

		if (lastSync && importSuccessful) {
			if (element !== null) {
				element.innerText = `Last sync done at ${currentTime}`;
				element = null;
			}
			if (!storedSuffix || currentDateSuffix > storedSuffix) {
				await handleBackupFiles();
			}
			if (
				!backupIntervalRunning &&
				localStorage.getItem('activeTabBackupRunning') !== 'true'
			) {
				startBackupInterval();
			}
		}
	} else {
		localStorage.setItem('activeTabBackupRunning', 'false');
		clearInterval(backupInterval);
		backupIntervalRunning = false;
	}
});

// Time based backup creates a rolling backup every X minutes. Default is 15 minutes
// Update parameter 'TIME_BACKUP_INTERVAL' in the beginning of the code to customize this
// This is to provide a secondary backup option in case of unintended corruption of the backup file
async function handleTimeBasedBackup() {
	const bucketName = localStorage.getItem('aws-bucket');
	let lastTimeBackup = localStorage.getItem('last-time-based-no-touch-backup');
	const currentTime = new Date().getTime();

	if (!lastTimeBackup) {
		localStorage.setItem(
			'last-time-based-no-touch-backup',
			new Date().toLocaleString()
		);
		lastTimeBackup = '0';
	}

	if (
		lastTimeBackup === '0' ||
		currentTime - new Date(lastTimeBackup).getTime() >=
			TIME_BACKUP_INTERVAL * 60 * 1000
	) {
		const s3 = new AWS.S3();

		try {
			const data = await exportBackupData();
			const dataStr = JSON.stringify(data);
			const jszip = await loadJSZip();
			const zip = new jszip();
			zip.file(`${TIME_BACKUP_FILE_PREFIX}.json`, dataStr, {
				compression: 'DEFLATE',
				compressionOptions: {
					level: 9,
				},
			});

			const compressedContent = await zip.generateAsync({ type: 'blob' });
			const uploadParams = {
				Bucket: bucketName,
				Key: `${TIME_BACKUP_FILE_PREFIX}.zip`,
				Body: compressedContent,
				ContentType: 'application/zip',
			};

			await s3.putObject(uploadParams).promise();
			localStorage.setItem(
				'last-time-based-no-touch-backup',
				new Date(currentTime).toLocaleString()
			);
		} catch (error) {
			console.error('Error creating time-based backup:', error);
		}
	}
}

// Function to check for backup file and import it
async function checkAndImportBackup() {
	const bucketName = localStorage.getItem('aws-bucket');
	const awsRegion = localStorage.getItem('aws-region');
	const awsAccessKey = localStorage.getItem('aws-access-key');
	const awsSecretKey = localStorage.getItem('aws-secret-key');
	const awsEndpoint = localStorage.getItem('aws-endpoint');

	if (bucketName && awsAccessKey && awsSecretKey) {
		if (typeof AWS === 'undefined') {
			await loadAwsSdk();
		}

		const awsConfig = {
			accessKeyId: awsAccessKey,
			secretAccessKey: awsSecretKey,
			region: awsRegion,
		};

		if (awsEndpoint) {
			awsConfig.endpoint = awsEndpoint;
		}

		AWS.config.update(awsConfig);

		const s3 = new AWS.S3();
		const params = {
			Bucket: bucketName,
			Key: 'typingmind-backup.json',
		};

		return new Promise((resolve) => {
			s3.getObject(params, async function (err) {
				if (!err) {
					await importFromS3();
					wasImportSuccessful = true;
					resolve(true);
				} else {
					if (err.code === 'NoSuchKey') {
						alert(
							"Backup file not found in S3! Run an adhoc 'Export to S3' first."
						);
					} else {
						localStorage.setItem('aws-bucket', '');
						localStorage.setItem('aws-access-key', '');
						localStorage.setItem('aws-secret-key', '');
						alert('Failed to connect to AWS. Please check your credentials.');
					}
					resolve(false);
				}
			});
		});
	}
	return false;
}

async function loadBackupFiles() {
	const bucketName = localStorage.getItem('aws-bucket');
	const awsAccessKey = localStorage.getItem('aws-access-key');
	const awsSecretKey = localStorage.getItem('aws-secret-key');

	const select = document.getElementById('backup-files');

	// Check if credentials are available
	if (!bucketName || !awsAccessKey || !awsSecretKey) {
		select.innerHTML =
			'<option value="">Please configure AWS credentials first</option>';
		updateBackupButtons();
		return;
	}

	const s3 = new AWS.S3();

	try {
		const data = await s3.listObjectsV2({ Bucket: bucketName }).promise();
		select.innerHTML = '';

		if (data.Contents.length === 0) {
			select.innerHTML = '<option value="">No backup files found</option>';
		} else {
			// Sort files by last modified (newest first)
			const files = data.Contents.sort(
				(a, b) => b.LastModified - a.LastModified
			);

			files.forEach((file) => {
				const option = document.createElement('option');
				option.value = file.Key;
				option.textContent = `${file.Key} (${new Date(file.LastModified).toLocaleString()})`;
				select.appendChild(option);
			});
		}

		updateBackupButtons();
	} catch (error) {
		console.error('Error loading backup files:', error);
		select.innerHTML = '<option value="">Error loading backups</option>';
		updateBackupButtons();
	}
}

function updateBackupButtons() {
	const select = document.getElementById('backup-files');
	const downloadBtn = document.getElementById('download-backup-btn');
	const restoreBtn = document.getElementById('restore-backup-btn');
	const refreshBtn = document.getElementById('refresh-backups-btn');

	const bucketConfigured =
		localStorage.getItem('aws-bucket') &&
		localStorage.getItem('aws-access-key') &&
		localStorage.getItem('aws-secret-key');

	// Enable/disable refresh button based on credentials
	if (refreshBtn) {
		refreshBtn.disabled = !bucketConfigured;
		refreshBtn.classList.toggle('opacity-50', !bucketConfigured);
	}

	const selectedFile = select.value;

	// Enable download button if credentials exist and file is selected
	if (downloadBtn) {
		downloadBtn.disabled = !bucketConfigured || !selectedFile;
		downloadBtn.classList.toggle(
			'opacity-50',
			!bucketConfigured || !selectedFile
		);
	}

	// Enable restore button if credentials exist and valid file is selected
	if (restoreBtn) {
		restoreBtn.disabled =
			!bucketConfigured ||
			!selectedFile ||
			selectedFile === 'typingmind-backup.json';
		restoreBtn.classList.toggle(
			'opacity-50',
			!bucketConfigured || !selectedFile
		);
	}
}

async function downloadBackupFile() {
  const bucketName = localStorage.getItem('aws-bucket');
  const s3 = new AWS.S3();
  const selectedFile = document.getElementById('backup-files').value;

  try {
    const data = await s3
      .getObject({
        Bucket: bucketName,
        Key: selectedFile,
      })
      .promise();

    if (selectedFile.endsWith('.zip')) {
      // For zip files, download directly
      const blob = new Blob([data.Body], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      // For JSON files, try to decode if possible
      try {
        const content = data.Body.toString('utf-8');
        // Check if the content is base64 encoded
        const isBase64 = /^[A-Za-z0-9+/=]+$/g.test(content.trim());
        
        let finalContent;
        if (isBase64) {
          // If it's encoded, decode it
          const decodedData = decodeFromStorage(content);
          finalContent = JSON.stringify(decodedData, null, 2);
        } else {
          // If it's not encoded, use as is
          finalContent = content;
        }

        const blob = new Blob([finalContent], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.replace('.json', '_decoded.json');
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (e) {
        // If decoding fails, download the raw content
        console.warn('Failed to decode content, downloading raw file:', e);
        const blob = new Blob([data.Body], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    alert('Error downloading file: ' + error.message);
  }
}

async function restoreBackupFile() {
  const bucketName = localStorage.getItem('aws-bucket');
  const s3 = new AWS.S3();
  const selectedFile = document.getElementById('backup-files').value;

  try {
    const data = await s3.getObject({
      Bucket: bucketName,
      Key: selectedFile,
    }).promise();

    if (!data || !data.Body) {
      throw new Error('No data found in backup file');
    }

    // If it's a zip file, handle it differently
    if (selectedFile.endsWith('.zip')) {
      const jszip = await loadJSZip();
      const zip = await jszip.loadAsync(data.Body);
      const files = Object.keys(zip.files);
      
      if (!files || files.length === 0) {
        throw new Error('Zip file is empty');
      }

      const jsonFile = files[0];
      const content = await zip.file(jsonFile).async('string');
      
      if (!content) {
        throw new Error('No content found in zip file');
      }

      // Add debugging logs
      //console.log('Zip content:', content);

      let importedData;
      try {
        importedData = JSON.parse(content);
        
        // Verify data structure before proceeding
        if (!importedData || !importedData.localStorage || !importedData.indexedDB) {
          throw new Error('Invalid backup data structure');
        }

        // Create a properly structured object for import
        const dataToImport = {
          localStorage: importedData.localStorage || {},
          indexedDB: importedData.indexedDB || {}
        };

        //console.log('Data to import:', dataToImport);
        importDataToStorage(dataToImport);
      } catch (e) {
        console.error('Parse error:', e);
        throw new Error(`Failed to parse backup data: ${e.message}`);
      }
    } else {
      // Handle regular JSON file
      const content = data.Body.toString('utf-8');
      
      if (!content) {
        throw new Error('Empty backup file');
      }

      //console.log('Raw content:', content);

      try {
        const decodedData = decodeFromStorage(content);
        
        // Verify data structure before proceeding
        if (!decodedData || !decodedData.localStorage || !decodedData.indexedDB) {
          throw new Error('Invalid backup data structure');
        }

        // Create a properly structured object for import
        const dataToImport = {
          localStorage: decodedData.localStorage || {},
          indexedDB: decodedData.indexedDB || {}
        };

        //console.log('Decoded data:', dataToImport);
        importDataToStorage(dataToImport);
      } catch (e) {
        console.error('Decode error:', e);
        throw new Error(`Failed to decode backup data: ${e.message}`);
      }
    }

    const currentTime = new Date().toLocaleString();
    localStorage.setItem('last-cloud-sync', currentTime);
    const element = document.getElementById('last-sync-msg');
    if (element) {
      element.innerText = `Last sync done at ${currentTime}`;
    }

    alert('Backup restored successfully!');
  } catch (error) {
    console.error('Error restoring backup:', error);
    alert(`Error restoring backup: ${error.message}`);
    
    const element = document.getElementById('action-msg');
    if (element) {
      element.textContent = `Restore failed: ${error.message}`;
      element.style.color = 'red';
    }
  }
}


// Function to start the backup interval
function startBackupInterval() {
	if (backupIntervalRunning) return;
	// Check if another tab is already running the backup
	if (localStorage.getItem('activeTabBackupRunning') === 'true') {
		return;
	}
	backupIntervalRunning = true;
	localStorage.setItem('activeTabBackupRunning', 'true');
	backupInterval = setInterval(async () => {
		if (wasImportSuccessful && !isExportInProgress) {
			isExportInProgress = true;
			await backupToS3();
			isExportInProgress = false;
		}
	}, 60000);
}

// Function to load AWS SDK asynchronously
async function loadAwsSdk() {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = 'https://sdk.amazonaws.com/js/aws-sdk-2.804.0.min.js';
		script.onload = resolve;
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

// Function to dynamically load the JSZip library
async function loadJSZip() {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src =
			'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.5.0/jszip.min.js';
		script.onload = () => {
			resolve(window.JSZip); // Pass JSZip to resolve
		};
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

// Function to import data from S3 to localStorage and IndexedDB
function importDataToStorage(data) {
  // Validate input
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data format provided to importDataToStorage');
  }

  // Ensure required properties exist
  data.localStorage = data.localStorage || {};
  data.indexedDB = data.indexedDB || {};

  // Import localStorage data
  try {
    Object.entries(data.localStorage).forEach(([key, value]) => {
      if (key && value !== undefined) {
        localStorage.setItem(key, value);
      }
    });
  } catch (e) {
    console.error('Error importing localStorage data:', e);
  }

  // Import IndexedDB data
  const request = indexedDB.open('keyval-store');
  
  request.onerror = function(event) {
    console.error('IndexedDB error:', event);
    throw new Error('Failed to open IndexedDB');
  };

  request.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction(['keyval'], 'readwrite');
    const objectStore = transaction.objectStore('keyval');

    const deleteRequest = objectStore.clear();
    
    deleteRequest.onsuccess = function() {
      Object.entries(data.indexedDB).forEach(([key, value]) => {
        if (key && value !== undefined) {
          try {
            objectStore.put(value, key);
          } catch (e) {
            console.error(`Error setting IndexedDB key ${key}:`, e);
          }
        }
      });
    };

    deleteRequest.onerror = function(event) {
      console.error('Error clearing IndexedDB:', event);
    };
  };

  // Handle extension URL
  try {
    let extensionURLs = JSON.parse(
      localStorage.getItem('TM_useExtensionURLs') || '[]'
    );
    if (!extensionURLs.some((url) => url.endsWith('s3.js'))) {
      extensionURLs.push(
        'https://itcon-pty-au.github.io/typingmind-cloud-backup/s3.js'
      );
      localStorage.setItem('TM_useExtensionURLs', JSON.stringify(extensionURLs));
    }
  } catch (e) {
    console.error('Error handling extension URLs:', e);
  }
}

// Function to export data from localStorage and IndexedDB
function exportBackupData() {
	return new Promise((resolve, reject) => {
		var exportData = {
			localStorage: { ...localStorage },
			indexedDB: {},
		};
		var request = indexedDB.open('keyval-store', 1);
		request.onsuccess = function (event) {
			var db = event.target.result;
			var transaction = db.transaction(['keyval'], 'readonly');
			var store = transaction.objectStore('keyval');
			store.getAllKeys().onsuccess = function (keyEvent) {
				var keys = keyEvent.target.result;
				store.getAll().onsuccess = function (valueEvent) {
					var values = valueEvent.target.result;
					keys.forEach((key, i) => {
						exportData.indexedDB[key] = values[i];
					});
					resolve(exportData);
				};
			};
		};
		request.onerror = function (error) {
			reject(error);
		};
	});
}

// Function to handle backup to S3 with chunked multipart upload using Blob
async function backupToS3() {
	const bucketName = localStorage.getItem('aws-bucket');
	const awsRegion = localStorage.getItem('aws-region');
	const awsAccessKey = localStorage.getItem('aws-access-key');
	const awsSecretKey = localStorage.getItem('aws-secret-key');
	const awsEndpoint = localStorage.getItem('aws-endpoint');

	if (typeof AWS === 'undefined') {
		await loadAwsSdk();
	}

	const awsConfig = {
		accessKeyId: awsAccessKey,
		secretAccessKey: awsSecretKey,
		region: awsRegion,
	};

	if (awsEndpoint) {
		awsConfig.endpoint = awsEndpoint;
	}

	AWS.config.update(awsConfig);

	const data = await exportBackupData();
	const dataStr = JSON.stringify(data);
	const blob = new Blob([dataStr], { type: 'application/json' });
	const dataSize = blob.size;
	const chunkSize = 10 * 1024 * 1024;

	const s3 = new AWS.S3();

	if (dataSize > chunkSize) {
		const createMultipartParams = {
			Bucket: bucketName,
			Key: 'typingmind-backup.json',
		};

		const multipart = await s3
			.createMultipartUpload(createMultipartParams)
			.promise();
		const promises = [];

		let partNumber = 1;
		let start = 0;

		while (start < dataSize) {
			const end = Math.min(start + chunkSize, dataSize);
			const chunkBlob = blob.slice(start, end);

			const partPromise = new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = async (event) => {
					const partParams = {
						Body: event.target.result,
						Bucket: bucketName,
						Key: 'typingmind-backup.json',
						PartNumber: partNumber,
						UploadId: multipart.UploadId,
					};

					try {
						const result = await s3.uploadPart(partParams).promise();
						resolve({ ETag: result.ETag, PartNumber: partNumber });
					} catch (err) {
						reject(err);
					}

					partNumber++;
				};

				reader.onerror = (error) => {
					reject(error);
				};

				reader.readAsArrayBuffer(chunkBlob);
			});

			promises.push(partPromise);
			start = end;
		}

		const uploadedParts = await Promise.all(promises);

		const completeParams = {
			Bucket: bucketName,
			Key: 'typingmind-backup.json',
			UploadId: multipart.UploadId,
			MultipartUpload: {
				Parts: uploadedParts,
			},
		};
		await s3.completeMultipartUpload(completeParams).promise();
	} else {
		const putParams = {
			Bucket: bucketName,
			Key: 'typingmind-backup.json',
			Body: dataStr,
			ContentType: 'application/json',
		};

		await s3.putObject(putParams).promise();
	}
	await handleTimeBasedBackup();
	const currentTime = new Date().toLocaleString();
	localStorage.setItem('last-cloud-sync', currentTime);
	var element = document.getElementById('last-sync-msg');
	if (element !== null) {
		element.innerText = `Last sync done at ${currentTime}`;
	}
	startBackupInterval();
}

// Function to handle import from S3
async function importFromS3() {
	const bucketName = localStorage.getItem('aws-bucket');
	const awsRegion = localStorage.getItem('aws-region');
	const awsAccessKey = localStorage.getItem('aws-access-key');
	const awsSecretKey = localStorage.getItem('aws-secret-key');
	const awsEndpoint = localStorage.getItem('aws-endpoint');

	if (typeof AWS === 'undefined') {
		await loadAwsSdk();
	}

	const awsConfig = {
		accessKeyId: awsAccessKey,
		secretAccessKey: awsSecretKey,
		region: awsRegion,
	};

	if (awsEndpoint) {
		awsConfig.endpoint = awsEndpoint;
	}

	AWS.config.update(awsConfig);

	const s3 = new AWS.S3();
	const params = {
		Bucket: bucketName,
		Key: 'typingmind-backup.json',
	};

	s3.getObject(params, function (err, data) {
		const actionMsgElement = document.getElementById('action-msg');
		if (err) {
			actionMsgElement.textContent = `Error fetching data: ${err.message}`;
			actionMsgElement.style.color = 'white';
			return;
		}

		const importedData = JSON.parse(data.Body.toString('utf-8'));
		importDataToStorage(importedData);
		const currentTime = new Date().toLocaleString();
		localStorage.setItem('last-cloud-sync', currentTime);
		var element = document.getElementById('last-sync-msg');
		if (element !== null) {
			element.innerText = `Last sync done at ${currentTime}`;
		}
		wasImportSuccessful = true;
	});
}
// Validate the AWS connection
async function validateAwsCredentials(bucketName, accessKey, secretKey) {
	const awsRegion = localStorage.getItem('aws-region');
	const awsEndpoint = localStorage.getItem('aws-endpoint');

	if (typeof AWS === 'undefined') {
		await loadAwsSdk();
	}

	const awsConfig = {
		accessKeyId: accessKey,
		secretAccessKey: secretKey,
		region: awsRegion,
	};

	if (awsEndpoint) {
		awsConfig.endpoint = awsEndpoint;
	}

	AWS.config.update(awsConfig);

	const s3 = new AWS.S3();
	const params = {
		Bucket: bucketName,
		MaxKeys: 1,
	};

	return new Promise((resolve, reject) => {
		s3.listObjectsV2(params, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
}

// Enhanced utility functions for encoding/decoding using browser-safe methods
function encodeForStorage(data) {
    try {
        const safeData = JSON.stringify(data, (key, value) => {
            if (typeof value === 'string') {
                return value
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;')
                    .replace(/\{\{/g, '__DBLCURLY_OPEN__')
                    .replace(/\}\}/g, '__DBLCURLY_CLOSE__')
                    .replace(/\\/g, '__BACKSLASH__')
                    .replace(/\u0000-\u001F/g, '')
                    .replace(/[\u007F-\u009F]/g, '');
            }
            return value;
        });

        // For regular backup/restore operations
        return btoa(unescape(encodeURIComponent(safeData)));
    } catch (error) {
        console.error('Encoding error:', error);
        throw error;
    }
}

function decodeFromStorage(data) {
  try {
    // Check if the data is base64 encoded
    const isBase64 = /^[A-Za-z0-9+/=]+$/g.test(data.trim());

    let decodedString;
    if (isBase64) {
      // For regular backup/restore operations
      decodedString = decodeURIComponent(escape(atob(data)));
    } else {
      // For downloaded files that are already in JSON format
      decodedString = data;
    }

    return JSON.parse(decodedString, (key, value) => {
      if (typeof value === 'string') {
        return value
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/__DBLCURLY_OPEN__/g, '{{')
          .replace(/__DBLCURLY_CLOSE__/g, '}}')
          .replace(/__BACKSLASH__/g, '\\');
      }
      return value;
    });
  } catch (error) {
    console.error('Decoding error:', error);
    // Instead of throwing, return the raw data
    return data;
  }
}

// Utility function to safely stringify JSON
function safeStringify(obj) {
	try {
		return JSON.stringify(obj, (key, value) => {
			if (value === undefined) {
				return '__UNDEFINED__';
			}
			if (Number.isNaN(value)) {
				return '__NAN__';
			}
			if (value === Infinity) {
				return '__INFINITY__';
			}
			if (value === -Infinity) {
				return '__NEGATIVE_INFINITY__';
			}
			if (typeof value === 'function') {
				return `__FUNCTION__${value.toString()}`;
			}
			if (value instanceof Date) {
				return `__DATE__${value.toISOString()}`;
			}
			if (value instanceof RegExp) {
				return `__REGEXP__${value.toString()}`;
			}
			return value;
		});
	} catch (error) {
		console.error('Error stringifying data:', error);
		throw error;
	}
}

// Utility function to safely parse JSON
function safeParse(str) {
	try {
		return JSON.parse(str, (key, value) => {
			if (typeof value === 'string') {
				if (value === '__UNDEFINED__') {
					return undefined;
				}
				if (value === '__NAN__') {
					return NaN;
				}
				if (value === '__INFINITY__') {
					return Infinity;
				}
				if (value === '__NEGATIVE_INFINITY__') {
					return -Infinity;
				}
				if (value.startsWith('__FUNCTION__')) {
					return new Function(`return ${value.slice(12)}`)();
				}
				if (value.startsWith('__DATE__')) {
					return new Date(value.slice(8));
				}
				if (value.startsWith('__REGEXP__')) {
					const match = value.slice(10).match(/\/(.*?)\/([gimy]*)$/);
					return new RegExp(match[1], match[2]);
				}
			}
			return value;
		});
	} catch (error) {
		console.error('Error parsing data:', error);
		throw error;
	}
}

// Function to create a dated backup copy, zip it, and purge old backups
async function handleBackupFiles() {
	//console.log('Inside handleBackupFiles');

	const bucketName = localStorage.getItem('aws-bucket');
	const awsRegion = localStorage.getItem('aws-region');
	const awsAccessKey = localStorage.getItem('aws-access-key');
	const awsSecretKey = localStorage.getItem('aws-secret-key');
	const awsEndpoint = localStorage.getItem('aws-endpoint');

	if (typeof AWS === 'undefined') {
		await loadAwsSdk();
	}

	const awsConfig = {
		accessKeyId: awsAccessKey,
		secretAccessKey: awsSecretKey,
		region: awsRegion,
	};

	if (awsEndpoint) {
		awsConfig.endpoint = awsEndpoint;
	}

	AWS.config.update(awsConfig);

	const s3 = new AWS.S3();
	const params = {
		Bucket: bucketName,
		Prefix: 'typingmind-backup',
	};

	const today = new Date();
	const currentDateSuffix = `${today.getFullYear()}${String(
		today.getMonth() + 1
	).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

	s3.listObjectsV2(params, async (err, data) => {
		if (err) {
			console.error('Error listing S3 objects:', err);
			return;
		}
		//console.log('object Count:' + data.Contents.length);
		if (data.Contents.length > 0) {
			//console.log('Listobject API call: Object count is' + data.Contents.length);
			const lastModified = data.Contents[0].LastModified;
			const lastModifiedDate = new Date(lastModified);
			if (lastModifiedDate.setHours(0, 0, 0, 0) < today.setHours(0, 0, 0, 0)) {
				const getObjectParams = {
					Bucket: bucketName,
					Key: 'typingmind-backup.json',
				};
				const backupFile = await s3.getObject(getObjectParams).promise();
				const backupContent = backupFile.Body;
				const jszip = await loadJSZip();
				const zip = new jszip();
				zip.file(`typingmind-backup-${currentDateSuffix}.json`, backupContent, {
					compression: 'DEFLATE',
					compressionOptions: {
						level: 9,
					},
				});

				const compressedContent = await zip.generateAsync({ type: 'blob' });

				const zipKey = `typingmind-backup-${currentDateSuffix}.zip`;
				const uploadParams = {
					Bucket: bucketName,
					Key: zipKey,
					Body: compressedContent,
					ContentType: 'application/zip',
				};
				await s3.putObject(uploadParams).promise();
				localStorage.setItem('last-daily-backup-in-s3', currentDateSuffix);
			}

			// Purge backups older than 30 days
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(today.getDate() - 30);
			for (const file of data.Contents) {
				if (
					file.Key.endsWith('.zip') &&
					file.Key !== 'typingmind-backup.json'
				) {
					const fileDate = new Date(file.LastModified);
					if (fileDate < thirtyDaysAgo) {
						const deleteParams = {
							Bucket: bucketName,
							Key: file.Key,
						};
						await s3.deleteObject(deleteParams).promise();
					}
				}
			}
		}
	});
}
