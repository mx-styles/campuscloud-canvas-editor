// App entry: create top file menu, initialize editor and implement menu actions
(() => {
	// State variables
	let recording = true;
	
	// Status message functions
	function showStatusMessage(message, type = 'info', duration = 3000) {
		const statusMessage = document.getElementById('status-message');
		if (!statusMessage) return;
		
		// Clear any existing timeout
		if (statusMessage._timeout) {
			clearTimeout(statusMessage._timeout);
		}
		
		// Set message and styling
		statusMessage.textContent = message;
		statusMessage.className = `status-message status-message-${type}`;
		statusMessage.style.opacity = '1';
		
		// Auto-hide after duration
		statusMessage._timeout = setTimeout(() => {
			statusMessage.style.opacity = '0';
		}, duration);
	}
	
	// Canvas persistence system - Multi-project support
	const PROJECTS_STORAGE_KEY = 'canvas-editor-projects';
	const CURRENT_PROJECT_KEY = 'canvas-editor-current';
	const RECENTS_STORAGE_KEY = 'canvas-editor-recents';
	const AUTO_SAVE_INTERVAL = 5000; // Auto-save every 5 seconds
	const MAX_PROJECTS = 10; // Maximum number of projects to keep in storage
	let autoSaveTimer = null;
	let lastSaveTime = null;
	let currentProjectId = null;
	
	// Status bar elements
	const statusElements = {
		persistence: null,
		canvasSize: null,
		zoom: null,
		objects: null,
		selection: null,
		lastSave: null
	};
	
	// Initialize status bar elements
	function initStatusBar() {
		statusElements.persistence = document.getElementById('status-persistence');
		statusElements.canvasSize = document.getElementById('status-canvas-size');
		statusElements.zoom = document.getElementById('status-zoom');
		statusElements.objects = document.getElementById('status-objects');
		statusElements.selection = document.getElementById('status-selection');
		statusElements.lastSave = document.getElementById('status-last-save');
		
		updateStatusBar();
	}
	
	// Update status bar information
	function updateStatusBar(editor = null) {
		const ed = editor || window.currentEditor;
		
		// Update persistence status
		if (statusElements.persistence) {
			const textSpan = statusElements.persistence.querySelector('.status-text');
			const iconSpan = statusElements.persistence.querySelector('.status-icon svg path');
			if (autoSaveTimer) {
				textSpan.textContent = 'Auto-save: On';
				// Use filled save icon for active state
				if (iconSpan) {
					iconSpan.setAttribute('d', 'M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z');
				}
				statusElements.persistence.className = 'status-item status-success';
			} else {
				textSpan.textContent = 'Auto-save: Off';
				// Use outline save icon for inactive state
				if (iconSpan) {
					iconSpan.setAttribute('d', 'M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z');
				}
				statusElements.persistence.className = 'status-item status-warning';
			}
		}
		
		// Update canvas size
		if (statusElements.canvasSize && ed) {
			const textSpan = statusElements.canvasSize.querySelector('.status-text');
			const width = ed.getWidth ? ed.getWidth() : (ed.state?.canvas?.workspaceWidth || 1200);
			const height = ed.getHeight ? ed.getHeight() : (ed.state?.canvas?.workspaceHeight || 610);
			textSpan.textContent = `${width} × ${height}`;
		}
		
		// Update zoom level
		if (statusElements.zoom && ed && ed.state?.canvas) {
			const textSpan = statusElements.zoom.querySelector('.status-text');
			const zoom = Math.round((ed.state.canvas.getZoom() || 1) * 100);
			textSpan.textContent = `${zoom}%`;
		}
		
		// Update object count
		if (statusElements.objects && ed) {
			const textSpan = statusElements.objects.querySelector('.status-text');
			let objectCount = 0;
			if (ed.getWorkspaceObjects) {
				objectCount = ed.getWorkspaceObjects().length;
			} else if (ed.state?.canvas?.getWorkspaceObjects) {
				objectCount = ed.state.canvas.getWorkspaceObjects().length;
			} else if (ed.state?.canvas?.getObjects) {
				// Subtract 1 for workspace background
				objectCount = Math.max(0, ed.state.canvas.getObjects().length - 1);
			}
			textSpan.textContent = `${objectCount} object${objectCount !== 1 ? 's' : ''}`;
		}
		
		// Update selection info
		if (statusElements.selection && ed && ed.state?.canvas) {
			const textSpan = statusElements.selection.querySelector('.status-text');
			const activeObjects = ed.state.canvas.getActiveObjects ? ed.state.canvas.getActiveObjects() : [];
			const activeObject = ed.state.canvas.getActiveObject ? ed.state.canvas.getActiveObject() : null;
			
			if (activeObjects && activeObjects.length > 1) {
				textSpan.textContent = `${activeObjects.length} selected`;
				statusElements.selection.className = 'status-item status-info';
			} else if (activeObject) {
				const objectType = activeObject.type || 'object';
				textSpan.textContent = `${objectType} selected`;
				statusElements.selection.className = 'status-item status-info';
			} else {
				textSpan.textContent = 'None selected';
				statusElements.selection.className = 'status-item';
			}
		}
		
		// Update last save time
		if (statusElements.lastSave) {
			const textSpan = statusElements.lastSave.querySelector('.status-text');
			if (lastSaveTime) {
				const now = new Date();
				const diff = now - lastSaveTime;
				let timeText;
				
				if (diff < 60000) { // Less than 1 minute
					timeText = 'Just now';
					statusElements.lastSave.className = 'status-item status-success';
				} else if (diff < 3600000) { // Less than 1 hour
					const minutes = Math.floor(diff / 60000);
					timeText = `${minutes}m ago`;
					statusElements.lastSave.className = 'status-item status-success';
				} else {
					const hours = Math.floor(diff / 3600000);
					timeText = `${hours}h ago`;
					statusElements.lastSave.className = 'status-item status-warning';
				}
				
				textSpan.textContent = `Saved ${timeText}`;
			} else {
				textSpan.textContent = 'Never saved';
				statusElements.lastSave.className = 'status-item status-error';
			}
		}
	}
	
	// Setup status bar update listeners
	function setupStatusBarListeners(editor) {
		// Prevent multiple attachments
		if (editor._statusBarListenersAttached) {
			return;
		}
		
		if (!editor || !editor.state?.canvas) return;
		
		const canvas = editor.state.canvas;
		
		// Listen for canvas changes that affect status
		canvas.on('after:render', () => updateStatusBar(editor));
		canvas.on('selection:created', () => updateStatusBar(editor));
		canvas.on('selection:updated', () => updateStatusBar(editor));
		canvas.on('selection:cleared', () => updateStatusBar(editor));
		canvas.on('object:added', () => updateStatusBar(editor));
		canvas.on('object:removed', () => updateStatusBar(editor));
		canvas.on('viewport:transform', () => updateStatusBar(editor));
		
		// Update status bar periodically for time-sensitive info
		setInterval(() => updateStatusBar(editor), 30000); // Update every 30 seconds
		
		editor._statusBarListenersAttached = true;
	}
	
	// Multi-project storage functions
	function generateProjectId() {
		return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
	}

	function getAllProjects() {
		try {
			const projects = localStorage.getItem(PROJECTS_STORAGE_KEY);
			return projects ? JSON.parse(projects) : {};
		} catch (error) {
			console.warn('Failed to load projects:', error);
			return {};
		}
	}

	function getStorageInfo() {
		try {
			const projects = localStorage.getItem(PROJECTS_STORAGE_KEY);
			const recents = localStorage.getItem(RECENTS_STORAGE_KEY);
			const current = localStorage.getItem(CURRENT_PROJECT_KEY);
			
			const projectsSize = projects ? projects.length : 0;
			const recentsSize = recents ? recents.length : 0;
			const currentSize = current ? current.length : 0;
			const totalSize = projectsSize + recentsSize + currentSize;
			
			// Estimate total localStorage usage
			let totalLocalStorage = 0;
			for (let key in localStorage) {
				if (localStorage.hasOwnProperty(key)) {
					totalLocalStorage += localStorage[key].length;
				}
			}
			
			return {
				projectsSize,
				recentsSize,
				currentSize,
				canvasEditorTotal: totalSize,
				totalLocalStorage,
				projectCount: projects ? Object.keys(JSON.parse(projects)).length : 0
			};
		} catch (error) {
			console.warn('Failed to get storage info:', error);
			return null;
		}
	}

	function cleanupOldProjects(projects, excludeProjectId = null, aggressiveCleanup = false) {
		let projectIds = Object.keys(projects);
		let cleanedCount = 0;
		
		// Determine how many projects to clean up
		let targetCount = aggressiveCleanup ? Math.max(1, MAX_PROJECTS - 3) : MAX_PROJECTS - 1;
		
		if (!aggressiveCleanup && projectIds.length < MAX_PROJECTS) {
			return { projects, cleanedCount }; // No cleanup needed
		}
		
		// Sort projects by timestamp (oldest first)
		const sortedProjects = projectIds
			.filter(id => id !== excludeProjectId)
			.map(id => ({ id, ...projects[id] }))
			.sort((a, b) => a.timestamp - b.timestamp);
		
		// Remove oldest projects until we reach target count
		while (projectIds.length > targetCount && sortedProjects.length > 0) {
			const oldestProject = sortedProjects.shift();
			const oldestId = oldestProject.id;
			
			console.log(`Auto-cleanup: Deleting project "${oldestProject.name}" (${oldestId}) created: ${new Date(oldestProject.timestamp).toLocaleString()}`);
			
			// Remove from projects
			delete projects[oldestId];
			cleanedCount++;
			
			// Remove from recents
			try {
				const recents = getRecentProjects();
				const updatedRecents = recents.filter(r => r.id !== oldestId);
				localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(updatedRecents));
			} catch (error) {
				console.warn('Failed to update recents during cleanup:', error);
			}
			
			// Clear current project if it was the one deleted (safety check)
			if (currentProjectId === oldestId) {
				currentProjectId = null;
				localStorage.removeItem(CURRENT_PROJECT_KEY);
			}
			
			// Update project count
			projectIds = Object.keys(projects);
		}
		
		if (cleanedCount > 0) {
			// Save the cleaned projects immediately
			try {
				localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
				const storageInfo = getStorageInfo();
				console.log(`Cleanup complete: Removed ${cleanedCount} project${cleanedCount > 1 ? 's' : ''}. Storage info:`, storageInfo);
				// showStatusMessage(`Auto-cleanup: Removed ${cleanedCount} old project${cleanedCount > 1 ? 's' : ''} to make room`, 'info', 4000);
			} catch (error) {
				console.warn('Failed to save cleaned projects:', error);
			}
		}
		
		return { projects, cleanedCount };
	}

	function saveProject(projectId, editor, projectName = null) {
		try {
			if (!editor || !editor.toJSON) return false;
			
			let projects = getAllProjects();
			const canvasData = editor.toJSON();
			const timestamp = Date.now();
			
			// Generate thumbnail (base64 data URL) - reduce quality for storage efficiency
			let thumbnail = null;
			try {
				// Try multiple methods to access the canvas
				let canvas = null;
				
				if (editor.canvas) {
					canvas = editor.canvas;
				} else if (editor.state && editor.state.canvas) {
					canvas = editor.state.canvas;
				} else if (editor.workspace && editor.workspace.state && editor.workspace.state.canvas) {
					canvas = editor.workspace.state.canvas;
				}
				
				if (canvas && canvas.toDataURL) {
					// Generate thumbnail at lower quality for storage efficiency
					thumbnail = canvas.toDataURL('image/jpeg', 0.2); // Reduced quality for storage
				} else {
					console.warn('Canvas not found or toDataURL not available for thumbnail generation');
				}
			} catch (e) {
				console.warn('Failed to generate thumbnail:', e);
			}

			// Check if we need to clean up old projects before adding new one
			const isNewProject = !projects[projectId]; // Check if this is a new project
			
			if (isNewProject) {
				// Clean up old projects if we're at the limit
				const cleanupResult = cleanupOldProjects(projects, projectId);
				projects = cleanupResult.projects;
			}

			// Create the new project data
			const projectData = {
				id: projectId,
				name: projectName || `Project ${new Date(timestamp).toLocaleDateString()}`,
				version: '1.0',
				timestamp: timestamp,
				canvas: canvasData,
				thumbnail: thumbnail
			};

			// Add the new project
			projects[projectId] = projectData;

			// Try to save - if quota exceeded, perform aggressive cleanup
			let saveAttempts = 0;
			const maxAttempts = 3;
			
			while (saveAttempts < maxAttempts) {
				try {
					localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
					break; // Success!
				} catch (quotaError) {
					if (quotaError.name === 'QuotaExceededError' && saveAttempts < maxAttempts - 1) {
						console.warn(`Quota exceeded on attempt ${saveAttempts + 1}, performing aggressive cleanup...`);
						
						// Aggressive cleanup - remove more projects
						const aggressiveCleanup = cleanupOldProjects(projects, projectId, true);
						projects = aggressiveCleanup.projects;
						
						// Also try without thumbnail if still failing
						if (saveAttempts === 1 && thumbnail) {
							console.warn('Removing thumbnail to reduce storage size...');
							projects[projectId].thumbnail = null;
						}
						
						saveAttempts++;
					} else {
						throw quotaError; // Re-throw if not quota error or max attempts reached
					}
				}
			}

			updateRecentProjects(projectId, projects[projectId]);
			lastSaveTime = new Date();
			currentProjectId = projectId;
			localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
			
			// console.log('Project saved:', projectId);
			updateStatusBar(editor);
			return true;
		} catch (error) {
			console.warn('Failed to save project:', error);
			if (error.name === 'QuotaExceededError') {
				showStatusMessage('Storage full - please clear browser data or use fewer projects', 'error', 6000);
			} else {
				showStatusMessage('Failed to save project', 'error');
			}
			return false;
		}
	}

	function loadProject(projectId) {
		try {
			const projects = getAllProjects();
			const project = projects[projectId];
			
			if (!project || !project.canvas) {
				console.warn('Project not found:', projectId);
				return null;
			}
			
			console.log('Loading project:', projectId, 'from:', new Date(project.timestamp));
			currentProjectId = projectId;
			localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
			return project.canvas;
		} catch (error) {
			console.warn('Failed to load project:', error);
			return null;
		}
	}

	function deleteProject(projectId) {
		try {
			const projects = getAllProjects();
			if (projects[projectId]) {
				delete projects[projectId];
				localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
				
				// Remove from recents
				const recents = getRecentProjects();
				const updatedRecents = recents.filter(r => r.id !== projectId);
				localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(updatedRecents));
				
				// Clear current project if it was deleted
				if (currentProjectId === projectId) {
					currentProjectId = null;
					localStorage.removeItem(CURRENT_PROJECT_KEY);
				}
				
				console.log('Project deleted:', projectId);
				return true;
			}
			return false;
		} catch (error) {
			console.warn('Failed to delete project:', error);
			return false;
		}
	}

	function updateRecentProjects(projectId, projectData) {
		try {
			const recents = getRecentProjects();
			
			// Remove existing entry if it exists
			const filtered = recents.filter(r => r.id !== projectId);
			
			// Add to beginning
			filtered.unshift({
				id: projectId,
				name: projectData.name,
				date: projectData.timestamp,
				thumbnail: projectData.thumbnail
			});
			
			// Keep only last 10 projects
			const limited = filtered.slice(0, 10);
			
			localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(limited));
		} catch (error) {
			console.warn('Failed to update recent projects:', error);
		}
	}

	function getRecentProjects() {
		try {
			const recents = localStorage.getItem(RECENTS_STORAGE_KEY);
			return recents ? JSON.parse(recents) : [];
		} catch (error) {
			console.warn('Failed to load recent projects:', error);
			return [];
		}
	}

	function saveCanvasState(editor) {
		if (!currentProjectId) {
			// Create new project if none exists
			console.warn('No current project ID found, creating new project for autosave');
			currentProjectId = generateProjectId();
			return saveProject(currentProjectId, editor, 'Auto-saved Project');
		}
		
		// For existing projects, check if we need to update the name
		const projects = getAllProjects();
		const existingProject = projects[currentProjectId];
		const projectName = existingProject ? existingProject.name : null;
		
		return saveProject(currentProjectId, editor, projectName);
	}
	
	function loadCanvasState() {
		try {
			// Try to load current project first
			const savedCurrentId = localStorage.getItem(CURRENT_PROJECT_KEY);
			if (savedCurrentId) {
				currentProjectId = savedCurrentId;
				return loadProject(savedCurrentId);
			}
			
			// Fallback: try to load from old system
			const oldSaved = localStorage.getItem('canvas-editor-state');
			if (oldSaved) {
				const saveData = JSON.parse(oldSaved);
				if (saveData.canvas) {
					console.log('Migrating from old storage system');
					// Create a new project from old data
					currentProjectId = generateProjectId();
					const projects = getAllProjects();
					projects[currentProjectId] = {
						id: currentProjectId,
						name: 'Migrated Project',
						version: '1.0',
						timestamp: saveData.timestamp || Date.now(),
						canvas: saveData.canvas,
						thumbnail: null
					};
					localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
					localStorage.setItem(CURRENT_PROJECT_KEY, currentProjectId);
					localStorage.removeItem('canvas-editor-state'); // Clean up old data
			return saveData.canvas;
				}
			}
			
			return null;
		} catch (error) {
			console.warn('Failed to load canvas state:', error);
			return null;
		}
	}
	
	function clearCanvasState() {
		try {
			if (currentProjectId) {
				console.log('Clearing current project:', currentProjectId);
				// Don't delete the project, just clear the current reference
				currentProjectId = null;
				localStorage.removeItem(CURRENT_PROJECT_KEY);
			}
			console.log('Canvas state cleared');
		} catch (error) {
			console.warn('Failed to clear canvas state:', error);
			throw error;
		}
	}

	// Helper function to handle the actual import process
	function proceedWithImport(data, ed, isProjectFile, validationResult, loadingOverlay) {
		// Update loading message for import
		hideLoading();
		loadingOverlay = showLoading('Importing to canvas...');
		
		setTimeout(() => {
			// Extract canvas data - handle nested structure
			let payload = data;
			
			if (data && typeof data === 'object' && data.data) {
				// Check if we have a nested data structure
				if (data.data.data && typeof data.data.data === 'object') {
					// Nested structure: use data.data.data for Fabric.js canvas data
					payload = data.data.data;
				} else {
					// Direct structure: use data.data
					payload = data.data;
				}
			}
			
			// Method 1: Load into workspace canvas
			if (ed && ed.workspace && ed.workspace.state && ed.workspace.state.canvas && ed.workspace.state.canvas.loadFromJSON) {
				// Method 1: Load into workspace canvas
				let callbackExecuted = false;
				ed.workspace.state.canvas.loadFromJSON(payload, () => {
					// Prevent multiple callback executions
					if (callbackExecuted) return;
					callbackExecuted = true;
					
					console.log('Project loaded successfully via workspace method');
					
					// Only save to persistence if we have a current project ID (don't create new projects during import)
					if (currentProjectId) {
						saveProject(currentProjectId, ed);
					}
					
					hideLoading();
					// Delay toast to ensure loading overlay is hidden first
					setTimeout(() => {
						const objectCount = ed.workspace.state.canvas.getObjects().length;
						const message = isProjectFile ? `Project loaded successfully` : `JSON imported successfully (${objectCount} objects)`;
						if (validationResult && validationResult.warnings && validationResult.warnings.length > 0) {
							showToast(message + ' - with warnings', 'warning');
						} else {
							showToast(message, 'success');
						}
					}, 100);
					forceCanvasRefresh(ed);
				});
			} else if (ed && ed.state && ed.state.canvas && ed.state.canvas.loadFromJSON) {
				// Method 2: Load into editor state canvas
				let callbackExecuted = false;
				ed.state.canvas.loadFromJSON(payload, () => {
					// Prevent multiple callback executions
					if (callbackExecuted) return;
					callbackExecuted = true;
					
					console.log('Project loaded successfully via state method');
					
					// Only save to persistence if we have a current project ID (don't create new projects during import)
					if (currentProjectId) {
						saveProject(currentProjectId, ed);
					}
					
					hideLoading();
					// Delay toast to ensure loading overlay is hidden first
					setTimeout(() => {
						const objectCount = ed.state.canvas.getObjects().length;
						const message = isProjectFile ? `Project loaded successfully (${objectCount} objects)` : `JSON imported successfully (${objectCount} objects)`;
						if (validationResult && validationResult.warnings && validationResult.warnings.length > 0) {
							showToast(message + ' - with warnings', 'warning');
						} else {
							showToast(message, 'success');
						}
					}, 100);
					forceCanvasRefresh(ed);
				});
			} else if (window.miniCanvasEditor && window.miniCanvasEditor.Editor && window.miniCanvasEditor.Editor.createFromJSON) {
				// Method 3: Recreate entire editor from JSON
				recording = false;
				const placeholder = document.getElementById('canvas');
				
				// Update loading message for editor recreation
				hideLoading();
				loadingOverlay = showLoading('Creating new editor...');
				
				// Stop existing auto-save
				stopAutoSave();
				
				// Clear existing editor
				while (placeholder.firstChild) placeholder.removeChild(placeholder.firstChild);
				
				window.miniCanvasEditor.Editor.createFromJSON(payload, placeholder, {}).then((newEd) => {
					window.currentEditor = newEd;
					
					// Apply all necessary setup to the new editor (prevent duplicates)
					if (!newEd._snapshotListenersAttached) {
						attachSnapshotListeners(newEd);
						newEd._snapshotListenersAttached = true;
					}
					applyWheelZoomOverride(newEd);
					
					if (newEd.startAutoLayout) newEd.startAutoLayout(true);
					
					// Setup persistence for the new editor (prevent duplicates)
					if (!newEd._autoSaveStarted) {
						startAutoSave(newEd);
						newEd._autoSaveStarted = true;
					}
					
					// Setup status bar listeners (prevent duplicates)
					if (!newEd._statusBarListenersAttached) {
						setupStatusBarListeners(newEd);
						newEd._statusBarListenersAttached = true;
					}
					
					if (newEd.onChanged && !newEd._changeListenerAttached) {
						newEd.onChanged.subscribe(() => {
							if (recording) {
								clearTimeout(newEd._saveTimeout);
								newEd._saveTimeout = setTimeout(() => saveCanvasState(newEd), 1000);
							}
						});
						newEd._changeListenerAttached = true;
					}
					
					// Only save to persistence if we have a current project ID (don't create new projects during import)
					if (currentProjectId) {
						saveProject(currentProjectId, newEd);
					}
					
					hideLoading();
					// Delay toast to ensure loading overlay is hidden first
					setTimeout(() => {
						const objectCount = newEd.state && newEd.state.canvas ? newEd.state.canvas.getObjects().length : 0;
						const message = isProjectFile ? `Project loaded successfully (${objectCount} objects)` : `JSON imported successfully (${objectCount} objects)`;
						if (validationResult && validationResult.warnings && validationResult.warnings.length > 0) {
							showToast(message + ' - with warnings', 'warning');
						} else {
							showToast(message, 'success');
						}
					}, 100);
					forceCanvasRefresh(newEd);
					
				}).catch(e => {
					console.error('createFromJSON import failed', e);
					hideLoading();
					setTimeout(() => {
						showToast('Load Project failed: ' + e.message, 'error');
					}, 100);
				}).finally(() => { 
					recording = true; 
				});
			} else {
				console.warn('No JSON load implementation available on editor instance');
				hideLoading();
				setTimeout(() => {
					showToast('Load Project not supported - no JSON loader available', 'error');
				}, 100);
			}
		}, 100);
	}

	// Function to handle project file loading (reusable for both Load Project button and Browse button)
	function loadProjectFile() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.ccjson';
		
		// Show loading immediately when user starts file selection
		let loadingOverlay = showLoading('Select a project file...');
		
		input.onchange = () => {
			const f = input.files && input.files[0];
			if (!f) {
				// User cancelled file selection
				hideLoading();
				return;
			}

			// Update loading message
			hideLoading();
			loadingOverlay = showLoading('Reading file...');

			// Check file extension - only allow .ccjson files
			const fileName = f.name.toLowerCase();
			if (!fileName.endsWith('.ccjson')) {
				hideLoading();
				showToast('Please select a valid .ccjson project file', 'error');
				return;
			}

			// This is always a project file now
			const isProjectFile = true;

			const reader = new FileReader();
			
			// Update loading message when file reading starts
			reader.onloadstart = () => {
				hideLoading();
				loadingOverlay = showLoading('Processing file...');
			};
			
			reader.onload = () => {
				// Update loading message for validation/import
				hideLoading();
				loadingOverlay = showLoading('Parsing file...');
				
				// Use setTimeout to allow UI thread to update
				setTimeout(() => {
					let validationResult = null;
					try {
						// Basic file content validation
						const fileContent = reader.result;
						
						// Check if file is empty
						if (!fileContent || fileContent.trim().length === 0) {
							console.error('File validation failed: File is empty or contains only whitespace');
							hideLoading();
							showToast('File is empty', 'error');
							return;
						}
						
						// Check file size before parsing
						if (fileContent.length > 100 * 1024 * 1024) { // 100MB
							console.error('File validation failed: File size exceeds 100MB limit. Size:', fileContent.length);
							hideLoading();
							showToast('File is too large', 'error');
							return;
						}
						
						// Basic JSON structure validation
						const trimmedContent = fileContent.trim();
						if (!trimmedContent.startsWith('{') && !trimmedContent.startsWith('[')) {
							console.error('File validation failed: File does not start with valid JSON structure. Content starts with:', trimmedContent.substring(0, 50));
							hideLoading();
							showToast('File does not have a valid ccjson format', 'error');
							return;
						}
						
						// Attempt to parse JSON
						const data = JSON.parse(fileContent);
						
						const ed = window.currentEditor || editor;
						if (!ed) {
							hideLoading();
							showToast('Editor not ready', 'error');
							return;
						}

						// Validate project file (always a .ccjson file now)
						hideLoading();
						loadingOverlay = showLoading('Validating project file...');
						
						setTimeout(() => {
							validationResult = validateProjectData(data);
							if (!validationResult.isValid) {
								hideLoading();
								console.error('Project file validation failed - Full details:', validationResult.errors);
								showToast('Invalid project file', 'error');
								return;
							}
							
							// Show warnings if any
							if (validationResult.warnings && validationResult.warnings.length > 0) {
								console.warn('Project validation warnings:', validationResult.warnings);
							}
							
							console.log('Loading project:', data.metadata);
							
							// Continue with import
							proceedWithImport(data, ed, isProjectFile, validationResult, loadingOverlay);
						}, 50);
					} catch (err) { 
						console.log('Import failed - Full error details:', err);
						console.log('Error message:', err.message);
						console.log('Error stack:', err.stack);
						hideLoading();
						
						// Delay toast to ensure loading overlay is hidden first
						setTimeout(() => {
							// Simple error messages for toast, detailed info in console
							if (err instanceof SyntaxError) {
								showToast('Invalid file format', 'error');
							} else if (err.name === 'RangeError') {
								showToast('File is too large to process', 'error');
							} else {
								showToast('Failed to load project', 'error');
							}
						}, 100);
					}
				}, 50); // Initial delay to allow UI thread to update
			};
			
			// Handle file reading errors
			reader.onerror = () => {
				hideLoading();
				showToast('Failed to read file', 'error');
			};
			
			reader.readAsText(f);
		};
		
		input.click();
	}

	// Expose functions globally for use in welcome modal
	window.deleteProject = deleteProject;
	window.getAllProjects = getAllProjects;
	window.getRecentProjects = getRecentProjects;
	window.saveProject = saveProject;
	window.loadProjectFile = loadProjectFile;
	window.getStorageInfo = getStorageInfo;
	
	function startAutoSave(editor) {
		// Prevent multiple autosave timers
		if (editor._autoSaveStarted) {
			return;
		}
		
		if (autoSaveTimer) clearInterval(autoSaveTimer);
		autoSaveTimer = setInterval(() => {
			if (recording && editor) {
				saveCanvasState(editor);
			}
		}, AUTO_SAVE_INTERVAL);
		editor._autoSaveStarted = true;
		console.log('Auto-save started (every', AUTO_SAVE_INTERVAL / 1000, 'seconds)');
		updateStatusBar(editor);
	}
	
	function stopAutoSave() {
		if (autoSaveTimer) {
			clearInterval(autoSaveTimer);
			autoSaveTimer = null;
			console.log('Auto-save stopped');
			updateStatusBar();
		}
	}

	// Minimal helper to create elements
	function el(tag, attrs = {}, ...children) {
		const e = document.createElement(tag);
		Object.keys(attrs).forEach(k => {
			if (k === 'class') e.className = attrs[k];
			else if (k === 'style') Object.assign(e.style, attrs[k]);
			else e.setAttribute(k, attrs[k]);
		});
		for (const c of children) if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c);
		return e;
	}

	// Helper to attach snapshot listeners (placeholder for now)
	function attachSnapshotListeners(editor) {
		// Prevent multiple attachments
		if (editor._snapshotListenersAttached) {
			return;
		}
		
		// This function can be expanded to attach any snapshot/history listeners if needed
		editor._snapshotListenersAttached = true;
		console.log('Snapshot listeners attached to editor');
	}

	// Simple toast notification system
	function showToast(message, type = 'info', duration = null) {
		// Set default durations based on type
		if (duration === null) {
			switch (type) {
				case 'success':
					duration = 4000; // Longer for success messages
					break;
				case 'error':
					duration = 6000; // Even longer for error messages
					break;
				case 'warning':
					duration = 5000; // Medium for warnings
					break;
				default:
					duration = 3000; // Default for info
			}
		}

		// Remove any existing toast of the same type
		const existingToasts = document.querySelectorAll('.toast');
		existingToasts.forEach(toast => {
			if (toast.classList.contains(`toast-${type}`)) {
				toast.remove();
			}
		});

		// Create toast element
		const toast = document.createElement('div');
		toast.className = `toast toast-${type}`;
		toast.textContent = message;
		toast.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 12px 20px;
			border-radius: 4px;
			color: white;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			font-size: 14px;
			z-index: 10002;
			max-width: 400px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			animation: slideIn 0.3s ease-out;
			transition: opacity 0.3s ease;
		`;

		// Set background color based on type
		switch (type) {
			case 'success':
				toast.style.backgroundColor = '#10b981';
				break;
			case 'error':
				toast.style.backgroundColor = '#ef4444';
				break;
			case 'warning':
				toast.style.backgroundColor = '#f59e0b';
				break;
			default:
				toast.style.backgroundColor = '#3b82f6';
		}

		// Add animation keyframes if not already present
		if (!document.querySelector('#toast-styles')) {
			const style = document.createElement('style');
			style.id = 'toast-styles';
			style.textContent = `
				@keyframes slideIn {
					from { transform: translateX(100%); opacity: 0; }
					to { transform: translateX(0); opacity: 1; }
				}
				@keyframes slideOut {
					from { transform: translateX(0); opacity: 1; }
					to { transform: translateX(100%); opacity: 0; }
				}
				.toast {
					pointer-events: auto;
					user-select: text;
				}
				.toast:hover {
					opacity: 0.9 !important;
				}
			`;
			document.head.appendChild(style);
		}

		// Add click to dismiss functionality
		toast.addEventListener('click', () => {
			toast.style.animation = 'slideOut 0.3s ease-in';
			setTimeout(() => toast.remove(), 300);
		});

		document.body.appendChild(toast);

		// Store the timeout ID so we can clear it if needed
		const timeoutId = setTimeout(() => {
			if (document.body.contains(toast)) {
				toast.style.animation = 'slideOut 0.3s ease-in';
				setTimeout(() => {
					if (document.body.contains(toast)) {
						toast.remove();
					}
				}, 300);
			}
		}, duration);

		// Store timeout ID on the element for potential cancellation
		toast._timeoutId = timeoutId;

		return toast;
	}

	// Loading indicator
	function showLoading(message = 'Loading...') {
		const existing = document.querySelector('.loading-overlay');
		if (existing) existing.remove();

		const overlay = document.createElement('div');
		overlay.className = 'loading-overlay';
		overlay.innerHTML = `
			<div class="loading-content">
				<div class="loading-spinner"></div>
				<div class="loading-text">${message}</div>
			</div>
		`;
		overlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.7);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 10001;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		`;

		// Add styles for spinner and content
		if (!document.querySelector('#loading-styles')) {
			const style = document.createElement('style');
			style.id = 'loading-styles';
			style.textContent = `
				.loading-content {
					background: white;
					padding: 30px;
					border-radius: 8px;
					text-align: center;
					min-width: 200px;
				}
				.loading-spinner {
					width: 40px;
					height: 40px;
					border: 4px solid #f3f3f3;
					border-top: 4px solid #3b82f6;
					border-radius: 50%;
					animation: spin 1s linear infinite;
					margin: 0 auto 15px;
				}
				.loading-text {
					font-size: 16px;
					color: #333;
				}
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
			`;
			document.head.appendChild(style);
		}

		document.body.appendChild(overlay);
		return overlay;
	}

	function hideLoading() {
		const overlay = document.querySelector('.loading-overlay');
		if (overlay) overlay.remove();
	}

	// Helper to apply wheel zoom override to an editor
	function applyWheelZoomOverride(editor) {
		if (editor && editor.state && editor.state.canvas) {
			try {
				const fabricCanvas = editor.state.canvas; // underlying fabric Canvas
				// Remove any existing wheel listeners we previously attached (best-effort)
				fabricCanvas.off && fabricCanvas.off('mouse:wheel');
				fabricCanvas.on('mouse:wheel', (opt) => {
					opt.e.preventDefault(); opt.e.stopPropagation();
					const delta = opt.e.deltaY;
					let zoom = fabricCanvas.getZoom();
					zoom *= Math.pow(0.999, delta);
					if (zoom > 20) zoom = 20; if (zoom < 0.01) zoom = 0.01;
					// Compute center point of visible canvas viewport (not workspace size which can differ while resizing)
					let PointCtor = (window.miniCanvasCore && window.miniCanvasCore.Point) || (window.fabric && window.fabric.Point);
					if (!PointCtor) return; // cannot zoom without Point
					const center = new PointCtor(fabricCanvas.width / 2, fabricCanvas.height / 2);
					fabricCanvas.zoomToPoint(center, zoom);
					// After zoom, keep canvas centered (optional: re-center to workspace)
					if (editor.state && editor.state.onZoomChanged && editor.state.onZoomChanged.forward) editor.state.onZoomChanged.forward();
				});
			} catch (e) { console.warn('Failed to override zoom behavior', e); }
		}
	}

		// Helper to get menu elements that are rendered in the DOM
		function getMenuElements() {
			return {
				newItem: document.getElementById('menu-new'),
				openItem: document.getElementById('menu-open'),
				saveItem: document.getElementById('menu-save'),
				exportJSON: document.getElementById('menu-export'),
				importJSON: document.getElementById('menu-import')
			};
		}

		// Project utility functions
		function createProjectData(editor) {
			if (!editor) throw new Error('Editor not available');
			
			let canvasData = null;
			
			// Try different methods to get canvas data
			if (editor.toJSON) {
				canvasData = editor.toJSON();
			} else if (editor.toImageJSON) {
				canvasData = editor.toImageJSON();
			} else if (editor.workspace && editor.workspace.toJSON) {
				canvasData = editor.workspace.toJSON();
			} else if (editor.state && editor.state.canvas && editor.state.canvas.toJSON) {
				canvasData = editor.state.canvas.toJSON();
			} else {
				throw new Error('Unable to serialize editor data');
			}

			return {
				version: "1.0",
				type: "CampusCloud Canvas Project",
				timestamp: new Date().toISOString(),
				metadata: {
					created: new Date().toISOString(),
					application: "CampusCloud Canvas Editor",
					canvasSize: {
						width: editor.state?.canvas?.width || 1200,
						height: editor.state?.canvas?.height || 610
					}
				},
				data: canvasData
			};
		}

		function validateProjectData(data) {
			const errors = [];
			const warnings = [];
			
			if (!data || typeof data !== 'object') {
				errors.push('Invalid project file format');
				return { isValid: false, errors, warnings };
			}

			if (!data.type || data.type !== "CampusCloud Canvas Project") {
				errors.push('Not a valid CampusCloud Canvas project file');
			}

			if (!data.version) {
				errors.push('Project file missing version information');
			}

			if (!data.data) {
				errors.push('Project file missing canvas data');
			}

			if (data.version && parseFloat(data.version) > 1.0) {
				errors.push(`Project was created with a newer version (${data.version}). This editor supports up to version 1.0.`);
			}

			// Additional validation checks
			if (data.metadata) {
				if (!data.metadata.created) {
					warnings.push('Project missing creation timestamp');
				}
				if (!data.metadata.application) {
					warnings.push('Project missing application information');
				}
			} else {
				warnings.push('Project missing metadata');
			}

			// Validate canvas data structure
			if (data.data) {
				if (typeof data.data !== 'object') {
					errors.push('Invalid canvas data format');
				} else {
					// Check for basic fabric.js structure or editor data
					const hasObjects = data.data.objects && Array.isArray(data.data.objects);
					const hasVersion = data.data.version;
					const hasWidth = data.data.width || data.data.canvasWidth;
					const hasHeight = data.data.height || data.data.canvasHeight;
					const hasBackground = data.data.background !== undefined;
					
					// Check nested data structure (common with editor exports)
					const hasNestedData = data.data.data && typeof data.data.data === 'object';
					const nestedHasObjects = hasNestedData && data.data.data.objects && Array.isArray(data.data.data.objects);
					const nestedHasVersion = hasNestedData && data.data.data.version;
					
					// Check if it looks like valid canvas data (either direct or nested)
					const looksLikeCanvasData = hasObjects || hasVersion || (hasWidth && hasHeight) || hasBackground || 
											  nestedHasObjects || nestedHasVersion;
					
					if (!looksLikeCanvasData) {
						// Check if it might be editor state data
						const isEditorData = data.data.canvas || data.data.state || data.data.workspace;
						if (!isEditorData) {
							warnings.push('Canvas data format may not be compatible');
						}
					}
				}
			}

			// Check file size (approximate)
			try {
				const dataSize = JSON.stringify(data).length;
				if (dataSize > 50 * 1024 * 1024) { // 50MB
					warnings.push('Large project file detected (>50MB). Loading may be slow.');
				}
			} catch (e) {
				warnings.push('Unable to determine project file size');
			}

			return {
				isValid: errors.length === 0,
				errors,
				warnings
			};
		}

		function validateJSONFormat(data) {
			const errors = [];
			const warnings = [];
			
			if (!data || typeof data !== 'object') {
				errors.push('Invalid JSON file format');
				return { isValid: false, errors, warnings };
			}

			// Check if it looks like a Fabric.js canvas JSON
			const hasFabricStructure = (
				data.version ||
				data.objects ||
				(data.background !== undefined) ||
				(data.overlayImage !== undefined) ||
				(data.backgroundImage !== undefined)
			);

			if (!hasFabricStructure) {
				// Check if it might be wrapped in a data property
				if (data.data && typeof data.data === 'object') {
					const innerData = data.data;
					const hasInnerFabricStructure = (
						innerData.version ||
						innerData.objects ||
						(innerData.background !== undefined) ||
						(innerData.overlayImage !== undefined) ||
						(innerData.backgroundImage !== undefined)
					);
					
					if (!hasInnerFabricStructure) {
						warnings.push('JSON structure does not appear to be a valid canvas format');
					}
				} else {
					warnings.push('JSON structure does not appear to be a valid canvas format');
				}
			}

			// Validate objects array if present
			if (data.objects) {
				if (!Array.isArray(data.objects)) {
					errors.push('Canvas objects property must be an array');
				} else {
					// Check a few objects for basic structure
					for (let i = 0; i < Math.min(5, data.objects.length); i++) {
						const obj = data.objects[i];
						if (!obj || typeof obj !== 'object') {
							warnings.push(`Object at index ${i} has invalid structure`);
							continue;
						}
						if (!obj.type) {
							warnings.push(`Object at index ${i} missing type property`);
						}
					}
				}
			}

			// Check for potential version compatibility issues
			if (data.version) {
				const version = parseFloat(data.version);
				if (version > 5.0) { // Fabric.js version check
					warnings.push(`Canvas was created with Fabric.js version ${data.version}. This may cause compatibility issues.`);
				}
			}

			// Check file size
			try {
				const dataSize = JSON.stringify(data).length;
				if (dataSize > 50 * 1024 * 1024) { // 50MB
					warnings.push('Large JSON file detected (>50MB). Loading may be slow.');
				}
			} catch (e) {
				warnings.push('Unable to determine file size');
			}

			return {
				isValid: errors.length === 0,
				errors,
				warnings
			};
		}

		function validateFileFormat(data, isProjectFile) {
			if (isProjectFile) {
				return validateProjectData(data);
			} else {
				return validateJSONFormat(data);
			}
		}

		function forceCanvasRefresh(editor) {
			if (!editor || !editor.state || !editor.state.canvas) return;
			
			const canvas = editor.state.canvas;
			
			// Multiple refresh attempts with different timing
			const refreshAttempts = [0, 100, 300, 500];
			
			refreshAttempts.forEach(delay => {
				setTimeout(() => {
					try {
						if (canvas.calcOffset) canvas.calcOffset();
						if (canvas.requestRenderAll) canvas.requestRenderAll();
						canvas.renderAll();
						
						// Force canvas element visibility
						const canvasEl = canvas.getElement();
						if (canvasEl) {
							canvasEl.style.visibility = 'visible';
							canvasEl.style.display = 'block';
							canvasEl.style.opacity = '1';
						}
					} catch (e) {
						console.warn('Canvas refresh attempt failed:', e);
					}
				}, delay);
			});
		}

	// initialization: attach menu and create mini editor
	function init() {
		const header = document.querySelector('.header');
		if (!header) return console.warn('Header not found');

		const { newItem, openItem, saveItem, exportJSON, importJSON } = getMenuElements();
		const saveStateButton = document.getElementById('menu-save-state');
		const clearStateButton = document.getElementById('menu-clear-state');
		if (!newItem || !openItem || !saveItem) console.warn('Menu elements not found in DOM.');

		// Initialize status bar
		initStatusBar();

		const placeholder = document.getElementById('canvas');
		
		// Check for saved canvas state
		const savedCanvasState = loadCanvasState();
		let editor;
		
		if (savedCanvasState && window.miniCanvasEditor && window.miniCanvasEditor.Editor && window.miniCanvasEditor.Editor.createFromJSON) {
			// Restore from saved state
			console.log('Restoring canvas from saved state...');
			showStatusMessage('Restoring previous canvas state...', 'info', 5000);
			
			window.miniCanvasEditor.Editor.createFromJSON(savedCanvasState, placeholder, { hand: true })
				.then((restoredEditor) => {
					editor = restoredEditor;
					window.currentEditor = editor;
					
					// Apply overrides and setup
					applyWheelZoomOverride(editor);
					if (editor && editor.startAutoLayout) editor.startAutoLayout(true);
					attachSnapshotListeners(editor);
					
					// Start auto-save for this editor
					startAutoSave(editor);
					
					// Setup status bar listeners
					setupStatusBarListeners(editor);
					
					// Setup change listener for immediate saves on important changes
					if (editor.onChanged) {
						editor.onChanged.subscribe(() => {
							if (recording) {
								// Debounced save on changes
								clearTimeout(editor._saveTimeout);
								editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
							}
						});
					}
					
					showStatusMessage('Canvas restored successfully', 'success');
					console.log('Canvas restored from localStorage');
				})
				.catch((error) => {
					console.warn('Failed to restore canvas state, creating blank editor:', error);
					showStatusMessage('Failed to restore canvas, starting fresh', 'warning');
					
					// Fallback to blank editor
					editor = window.miniCanvasEditor && window.miniCanvasEditor.Editor
						? window.miniCanvasEditor.Editor.createBlank(placeholder, 1200, 610, { hand: true })
						: null;
					
					if (editor) {
						window.currentEditor = editor;
						applyWheelZoomOverride(editor);
						if (editor.startAutoLayout) editor.startAutoLayout(true);
						attachSnapshotListeners(editor);
						startAutoSave(editor);
						
						// Setup status bar listeners
						setupStatusBarListeners(editor);
						
						// Setup change listener
						if (editor.onChanged) {
							editor.onChanged.subscribe(() => {
								if (recording) {
									clearTimeout(editor._saveTimeout);
									editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
								}
							});
						}
					}
				});
		} else {
			// Create blank editor (defaults are small; pick a large workspace)
			editor = window.miniCanvasEditor && window.miniCanvasEditor.Editor
				? window.miniCanvasEditor.Editor.createBlank(placeholder, 1200, 610, { hand: true })
				: null;
			
			if (editor) {
				window.currentEditor = editor;
				// Override wheel zoom to always zoom from canvas center (after editor creation)
				applyWheelZoomOverride(editor);
				// Start auto-resize layout if available
				if (editor.startAutoLayout) editor.startAutoLayout(true);
				attachSnapshotListeners(editor);
				
				// Create initial project for the blank canvas
				currentProjectId = generateProjectId();
				saveProject(currentProjectId, editor, 'Blank Project');
				
				// Start auto-save
				startAutoSave(editor);
				
				// Setup status bar listeners
				setupStatusBarListeners(editor);
				
				// Setup change listener for immediate saves on important changes
				if (editor.onChanged) {
					editor.onChanged.subscribe(() => {
						if (recording) {
							// Debounced save on changes
							clearTimeout(editor._saveTimeout);
							editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
						}
					});
				}
				
				console.log('Created new blank canvas with project ID:', currentProjectId);
			}
		}

		// Menu actions
		// Note: New Project button now only shows welcome modal (handled in index.html)

		// toggle dropdown on click (click opens/closes file menu)
		const fileMenuRoot = document.getElementById('file-menu');
		if (fileMenuRoot) fileMenuRoot.addEventListener('click', (ev) => {
			ev.stopPropagation();
			fileMenuRoot.classList.toggle('open');
		});
		document.addEventListener('click', () => { if (fileMenuRoot) fileMenuRoot.classList.remove('open'); });


				// bind undo/redo UI directly to editor history
				const undoBtn = document.getElementById('menu-undo');
				const redoBtn = document.getElementById('menu-redo');
				if (undoBtn) undoBtn.addEventListener('click', () => { const ed = window.currentEditor || editor; ed && ed.undo && ed.undo(); });
				if (redoBtn) redoBtn.addEventListener('click', () => { const ed = window.currentEditor || editor; ed && ed.redo && ed.redo(); });

		// keyboard shortcuts (native editor history)
		document.addEventListener('keydown', (e) => {
			const ed = window.currentEditor || editor;
			if (!ed) return;
			if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
				e.preventDefault(); ed.undo && ed.undo();
			}
			if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
				e.preventDefault(); ed.redo && ed.redo();
			}
		});

		if (openItem) openItem.addEventListener('click', async () => {
			// open image and add to the current editor (exactly like toolbox image button)
			if (!window.currentEditor) window.currentEditor = editor;
			const ed = window.currentEditor || editor;
			if (!ed) return;
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*';
			input.onchange = async () => {
				const f = input.files && input.files[0];
				if (!f) return;
				const reader = new FileReader();
				reader.onload = () => {
					const img = new Image();
					img.onload = () => {
						// Match toolbox: scale and add to editor using core's MceImage
						const core = window.miniCanvasCore;
						if (!core || !core.MceImage) { console.error('MceImage not available on miniCanvasCore'); return; }
						const scale = Math.max(img.width / ed.state.canvas.workspaceWidth, img.height / ed.state.canvas.workspaceHeight) || 1;
						try {
							const image = new core.MceImage(img, {
								left: 0,
								top: 0,
								width: img.width,
								height: img.height,
								scaleX: 1 / scale,
								scaleY: 1 / scale
							});
							ed.add(image);
						} catch (err) { console.error('Failed to create MceImage', err); }
					};
					img.src = reader.result;
				};
				reader.readAsDataURL(f);
			};
			input.click();
		});

		if (saveItem) saveItem.addEventListener('click', () => {
			// Render canvas to PNG and trigger download
			const ed = window.currentEditor || editor;
			if (!ed) {
				showToast('Editor not ready', 'error');
				return;
			}
			try {
				const canvas = ed.render();
				const a = document.createElement('a');
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
				a.download = `campuscloud-canvas.png`;
				a.href = canvas.toDataURL('image/png');
				a.click();
				showToast('PNG exported successfully', 'success');
			} catch (err) {
				console.error(err);
				showToast('PNG export failed: ' + err.message, 'error');
			}
		});

		if (exportJSON) exportJSON.addEventListener('click', () => {
			const ed = window.currentEditor || editor;
			if (!ed) {
				showToast('Editor not ready', 'error');
				return;
			}
			
			// Show loading immediately
			const loadingOverlay = showLoading('Preparing project data...');
			
			// Use setTimeout to allow UI thread to update
			setTimeout(() => {
				try {
					// Update loading message
					hideLoading();
					const loadingOverlay2 = showLoading('Creating project file...');
					
					setTimeout(() => {
						try {
							// Create project data with metadata
							const projectData = createProjectData(ed);
							const projectJson = JSON.stringify(projectData, null, 2);
							
							// Update loading message
							hideLoading();
							const loadingOverlay3 = showLoading('Downloading file...');
							
							setTimeout(() => {
								// Create and download the .ccjson file
								const blob = new Blob([projectJson], { type: 'application/json' });
								const a = document.createElement('a');
								
								// Generate filename with timestamp
								const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
								a.download = `campuscloud-canvas.ccjson`;
								a.href = URL.createObjectURL(blob);
								a.click();
								
								// Clean up the URL
								setTimeout(() => URL.revokeObjectURL(a.href), 100);
								
								hideLoading();
								setTimeout(() => {
									showToast('Project saved successfully', 'success');
								}, 100);
								console.log('Project saved successfully');
							}, 100);
						} catch (err) { 
							console.error('Export failed:', err); 
							hideLoading();
							setTimeout(() => {
								showToast('Save Project failed: ' + err.message, 'error');
							}, 100);
						}
					}, 100);
				} catch (err) {
					console.error('Export preparation failed:', err); 
					hideLoading();
					setTimeout(() => {
						showToast('Failed to prepare project data: ' + err.message, 'error');
					}, 100);
				}
			}, 50);
		});

		if (importJSON) importJSON.addEventListener('click', () => {
			loadProjectFile();
		});



		// expose editor globally for dev convenience
		window.currentEditor = editor;
		
		// Add beforeunload handler to save state before page closes
		window.addEventListener('beforeunload', () => {
			const ed = window.currentEditor;
			if (ed && recording) {
				saveCanvasState(ed);
			}
			stopAutoSave();
		});
		
		// Add visibility change handler to save when tab becomes hidden
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				const ed = window.currentEditor;
				if (ed && recording) {
					saveCanvasState(ed);
				}
			}
		});
		
		// Manual save state button
		if (saveStateButton) saveStateButton.addEventListener('click', () => {
			const ed = window.currentEditor;
			if (!ed) {
				showToast('Editor not ready', 'error');
					return;
				}
			try {
				saveCanvasState(ed);
				showStatusMessage('Canvas state saved to browser', 'success');
			} catch (error) {
				console.error('Failed to save state:', error);
				showToast('Failed to save state: ' + error.message, 'error');
			}
		});
		
		// Manual clear state button
		if (clearStateButton) clearStateButton.addEventListener('click', () => {
			console.log('Clear state button clicked');
			try {
				clearCanvasState();
				showStatusMessage('Browser data cleared', 'success');
				console.log('Browser data cleared successfully');
			} catch (error) {
				console.error('Failed to clear state:', error);
				showToast('Failed to clear data: ' + error.message, 'error');
			}
		});
	}

	// Welcome Modal Logic
	function initWelcomeModal() {
		const welcomeModal = document.getElementById('welcome-modal');
		const welcomeCloseBtn = document.getElementById('welcome-close-btn');
		const menuNew = document.getElementById('menu-new');
		const recentsContainer = document.getElementById('welcome-recents');
		const customFields = document.getElementById('custom-fields');
		const customWidth = document.getElementById('custom-width');
		const customHeight = document.getElementById('custom-height');
		const customApply = document.getElementById('custom-apply');

		// Template previews and ccjson files
		const templateData = {
			blank: {
				img: 'assets/blank.png',
				ccjson: null
			},
			'landing-hero-1': {
				img: 'assets/landing-hero-1.png',
				ccjson: 'landing-hero-1.ccjson'
			},
			'landing-hero-2': {
				img: 'assets/landing-hero-2.png',
				ccjson: 'landing-hero-2.ccjson'
			}
		};

		function showWelcomeModal() {
			// Regenerate thumbnail for current project to ensure it's up-to-date
			regenerateCurrentThumbnail();
			// Small delay to allow thumbnail generation before loading recents
					setTimeout(() => {
				loadRecentProjects();
			}, 100);

			welcomeModal.style.display = 'flex';
		}

		// Function to regenerate thumbnail for current project
		function regenerateCurrentThumbnail() {
			if (window.currentEditor && typeof window.saveProject === 'function') {
				const currentId = localStorage.getItem('canvas-editor-current');
				if (currentId) {
					// Get current project name
					const projects = JSON.parse(localStorage.getItem('canvas-editor-projects') || '{}');
					const projectName = projects[currentId] ? projects[currentId].name : null;
					
					// Re-save with new thumbnail
					window.saveProject(currentId, window.currentEditor, projectName);
					console.log('Regenerated thumbnail for current project');
				}
			}
		}

		function loadRecentProjects() {
			// Load recent projects from localStorage using new system
			let recents = [];
			try {
				recents = JSON.parse(localStorage.getItem('canvas-editor-recents') || '[]');
			} catch {}
			recentsContainer.innerHTML = '';
			
			const recentsContainerParent = recentsContainer.parentElement;
			
			if (recents.length === 0) {
				recentsContainer.innerHTML = '<div class="welcome-recent">No recent projects</div>';
				recentsContainerParent.classList.remove('has-overflow');
			} else {
				recents.forEach(r => {
					const el = document.createElement('div');
					el.className = 'welcome-recent';
					el.style.position = 'relative';
					
					// Thumbnail if available
					if (r.thumbnail && r.thumbnail.startsWith('data:image/')) {
						const img = document.createElement('img');
						img.src = r.thumbnail;
						img.alt = 'Project thumbnail';
						img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:6px;background:var(--mce-bg);border:1px solid var(--mce-panel-border);';
						
						// Fallback to placeholder if image fails to load
						img.onerror = () => {
							img.style.display = 'none';
							const placeholder = document.createElement('div');
							placeholder.style.cssText = 'width:64px;height:64px;background:var(--mce-panel-border);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--mce-text-muted);font-size:24px;';
							placeholder.textContent = '📄';
							el.insertBefore(placeholder, img);
						};
						
						el.appendChild(img);
								} else {
						// Default thumbnail placeholder
						const placeholder = document.createElement('div');
						placeholder.style.cssText = 'width:64px;height:64px;background:var(--mce-panel-border);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--mce-text-muted);font-size:24px;';
						placeholder.textContent = '📄';
						el.appendChild(placeholder);
					}
					
					const info = document.createElement('div');
					info.className = 'recent-info';
					const title = document.createElement('div');
					title.className = 'recent-title';
					title.textContent = r.name || 'Untitled';
					info.appendChild(title);
					if (r.date) {
						const date = document.createElement('div');
						date.className = 'recent-date';
						date.textContent = new Date(r.date).toLocaleString();
						info.appendChild(date);
					}
					el.appendChild(info);
					
					// Delete button
					const deleteBtn = document.createElement('button');
					deleteBtn.className = 'recent-delete';
					deleteBtn.innerHTML = '&times;';
					deleteBtn.title = 'Delete project';
					deleteBtn.onclick = (e) => {
						e.stopPropagation();
						if (confirm(`Delete "${r.name || 'Untitled'}"? This cannot be undone.`)) {
							deleteProjectFromModal(r.id);
							loadRecentProjects(); // Refresh the list
						}
					};
					el.appendChild(deleteBtn);
					
					// Click to load project
					el.onclick = () => {
						welcomeModal.style.display = 'none';
						document.dispatchEvent(new CustomEvent('load-recent-project', { detail: r }));
					};
					recentsContainer.appendChild(el);
				});
				
				// Check if there's horizontal overflow to show fade effect
			setTimeout(() => {
					if (recentsContainer.scrollWidth > recentsContainer.clientWidth) {
						recentsContainerParent.classList.add('has-overflow');
					} else {
						recentsContainerParent.classList.remove('has-overflow');
					}
				}, 10);
			}
		}

		function deleteProjectFromModal(projectId) {
			// Call the deleteProject function from app.js if available
			if (typeof window.deleteProject === 'function') {
				return window.deleteProject(projectId);
			}
			// Fallback: manually remove from storage
			try {
				const projects = JSON.parse(localStorage.getItem('canvas-editor-projects') || '{}');
				if (projects[projectId]) {
					delete projects[projectId];
					localStorage.setItem('canvas-editor-projects', JSON.stringify(projects));
				}
				
				const recents = JSON.parse(localStorage.getItem('canvas-editor-recents') || '[]');
				const updatedRecents = recents.filter(r => r.id !== projectId);
				localStorage.setItem('canvas-editor-recents', JSON.stringify(updatedRecents));
				
				return true;
			} catch (error) {
				console.warn('Failed to delete project:', error);
				return false;
			}
		}

		function hideWelcomeModal() {
			welcomeModal.style.display = 'none';
		}

		// Show on every page load
						setTimeout(() => {
			showWelcomeModal();
		}, 300);

		// Show on New Project
		if (menuNew) {
			menuNew.addEventListener('click', e => {
				e.preventDefault();
				showWelcomeModal();
			});
		}

		if (welcomeCloseBtn) {
			welcomeCloseBtn.addEventListener('click', hideWelcomeModal);
		}

		// Close modal with Escape key
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && welcomeModal && welcomeModal.style.display === 'flex') {
				hideWelcomeModal();
			}
		});

		// Close modal when clicking outside the content area
		if (welcomeModal) {
			welcomeModal.addEventListener('click', (e) => {
				if (e.target === welcomeModal) {
					hideWelcomeModal();
				}
			});
		}

		// Layout selection
		document.querySelectorAll('.welcome-layout').forEach(el => {
			el.addEventListener('click', () => {
				document.querySelectorAll('.welcome-layout').forEach(l => l.classList.remove('selected'));
				el.classList.add('selected');
				const layout = el.getAttribute('data-layout');
				if (layout === 'custom') {
					if (customFields) customFields.style.display = 'flex';
				} else {
					if (customFields) customFields.style.display = 'none';
					if (welcomeModal) welcomeModal.style.display = 'none';
					// Set document size for known layouts
					let size = { width: 1200, height: 610 };
					if (layout === 'avatar') size = { width: 120, height: 120 };
					if (layout === 'thumbnail') size = { width: 120, height: 120 };
					if (layout === 'profile-cover') size = { width: 1200, height: 500 };
					if (layout === 'preview-image') size = { width: 1200, height: 610 };
					document.dispatchEvent(new CustomEvent('new-project-layout', { detail: { layout, ...size } }));
				}
			});
		});

		if (customApply) {
			customApply.addEventListener('click', () => {
				const width = parseInt(customWidth.value, 10) || 1200;
				const height = parseInt(customHeight.value, 10) || 610;
				if (welcomeModal) welcomeModal.style.display = 'none';
				document.dispatchEvent(new CustomEvent('new-project-layout', { detail: { layout: 'custom', width, height } }));
			});
		}

		// Template selection
		document.querySelectorAll('.welcome-template').forEach(el => {
			const template = el.getAttribute('data-template');
			// Set preview image
			if (templateData[template] && el.querySelector('img')) {
				el.querySelector('img').src = templateData[template].img;
			}
			el.addEventListener('click', () => {
				document.querySelectorAll('.welcome-template').forEach(t => t.classList.remove('selected'));
				el.classList.add('selected');
				if (welcomeModal) welcomeModal.style.display = 'none';
				if (template === 'browse') {
					// Use the same function as Load Project button
					if (typeof window.loadProjectFile === 'function') {
						window.loadProjectFile();
					} else {
						// Fallback if function not available
						console.warn('loadProjectFile function not available');
						alert('Load Project functionality not available');
					}
				} else if (templateData[template] && templateData[template].ccjson) {
					fetch(templateData[template].ccjson)
						.then(r => r.json())
						.then(data => {
							document.dispatchEvent(new CustomEvent('new-project-template', { detail: { template, data } }));
						});
				} else {
					document.dispatchEvent(new CustomEvent('new-project-template', { detail: { template } }));
				}
			});
		});
	}

	// wait for DOM ready
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { init(); initWelcomeModal(); }); else { init(); initWelcomeModal(); }

// --- Welcome Modal Integration ---
document.addEventListener('new-project-layout', function(e) {
	const detail = e.detail || {};
	const placeholder = document.getElementById('canvas');
	// Remove old editor
	while (placeholder.firstChild) placeholder.removeChild(placeholder.firstChild);
	
	// Clear current project reference to start fresh
	currentProjectId = null;
	localStorage.removeItem(CURRENT_PROJECT_KEY);
	
	// Set size
	let width = detail.width || 1200;
	let height = detail.height || 610;
	
	// Create blank editor with size
	if (window.miniCanvasEditor && window.miniCanvasEditor.Editor) {
		const editor = window.miniCanvasEditor.Editor.createBlank(placeholder, width, height, { hand: true });
		window.currentEditor = editor;
		if (editor.startAutoLayout) editor.startAutoLayout(true);
		if (typeof applyWheelZoomOverride === 'function') applyWheelZoomOverride(editor);
		if (typeof attachSnapshotListeners === 'function') attachSnapshotListeners(editor);
		if (typeof startAutoSave === 'function') startAutoSave(editor);
		if (typeof setupStatusBarListeners === 'function') setupStatusBarListeners(editor);
		if (editor.onChanged) {
			editor.onChanged.subscribe(() => {
				if (typeof saveCanvasState === 'function' && typeof recording !== 'undefined') {
					clearTimeout(editor._saveTimeout);
					editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
				}
			});
		}
		// Create initial save with project name
		if (window.currentEditor) {
			let layoutName = 'Custom';
			if (detail.layout) {
				// Handle special layout names
				const layoutMap = {
					'profile-cover': 'Profile Cover',
					'preview-image': 'Preview Image',
					'avatar': 'Avatar',
					'thumbnail': 'Thumbnail',
					'custom': 'Custom'
				};
				layoutName = layoutMap[detail.layout] || detail.layout.charAt(0).toUpperCase() + detail.layout.slice(1);
			}
			const projectName = `${layoutName} Project`;
			currentProjectId = generateProjectId();
			saveProject(currentProjectId, window.currentEditor, projectName);
		}
		if (typeof showStatusMessage === 'function') showStatusMessage('New project created', 'success');
	}
});

document.addEventListener('new-project-template', function(e) {
	const detail = e.detail || {};
	const placeholder = document.getElementById('canvas');
	
	// Clear current project reference to start fresh
	currentProjectId = null;
	localStorage.removeItem(CURRENT_PROJECT_KEY);
	
	if (detail.data) {
		// Load ccjson data as project using proceedWithImport
		// Remove old editor first
		while (placeholder.firstChild) placeholder.removeChild(placeholder.firstChild);
		
		// Create editor first
		if (window.miniCanvasEditor && window.miniCanvasEditor.Editor) {
			const editor = window.miniCanvasEditor.Editor.createBlank(placeholder, 1200, 610, { hand: true });
				window.currentEditor = editor;
			
			// Apply all the standard editor setup
				if (editor.startAutoLayout) editor.startAutoLayout(true);
				if (typeof applyWheelZoomOverride === 'function') applyWheelZoomOverride(editor);
				if (typeof attachSnapshotListeners === 'function') attachSnapshotListeners(editor);
				if (typeof startAutoSave === 'function') startAutoSave(editor);
				if (typeof setupStatusBarListeners === 'function') setupStatusBarListeners(editor);
				if (editor.onChanged) {
					editor.onChanged.subscribe(() => {
						if (typeof saveCanvasState === 'function' && typeof recording !== 'undefined') {
							clearTimeout(editor._saveTimeout);
							editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
						}
					});
				}
			
			// Use proceedWithImport for consistent loading
			const loadingOverlay = showLoading('Loading template...');
			proceedWithImport(detail.data, editor, true, null, loadingOverlay);
			
			// Create initial save with project name after import completes
			setTimeout(() => {
				let templateName = 'Template';
				if (detail.template) {
					// Handle special template names
					const templateMap = {
						'landing-hero-1': 'Landing Hero 1',
						'landing-hero-2': 'Landing Hero 2',
						'blank': 'Blank',
						'browse': 'Custom Template'
					};
					templateName = templateMap[detail.template] || detail.template.charAt(0).toUpperCase() + detail.template.slice(1);
				}
				const projectName = `${templateName} Project`;
				currentProjectId = generateProjectId();
				saveProject(currentProjectId, window.currentEditor, projectName);
			}, 500);
		}
	} else {
		// Blank template: create blank editor
		// Remove old editor first
		while (placeholder.firstChild) placeholder.removeChild(placeholder.firstChild);
		
		if (window.miniCanvasEditor && window.miniCanvasEditor.Editor) {
			const editor = window.miniCanvasEditor.Editor.createBlank(placeholder, 1200, 610, { hand: true });
			window.currentEditor = editor;
			if (editor.startAutoLayout) editor.startAutoLayout(true);
			if (typeof applyWheelZoomOverride === 'function') applyWheelZoomOverride(editor);
			if (typeof attachSnapshotListeners === 'function') attachSnapshotListeners(editor);
			if (typeof startAutoSave === 'function') startAutoSave(editor);
			if (typeof setupStatusBarListeners === 'function') setupStatusBarListeners(editor);
			if (editor.onChanged) {
				editor.onChanged.subscribe(() => {
					if (typeof saveCanvasState === 'function' && typeof recording !== 'undefined') {
						clearTimeout(editor._saveTimeout);
						editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
					}
				});
			}
			// Create initial save with project name
			let templateName = 'Template';
			if (detail.template) {
				// Handle special template names
				const templateMap = {
					'landing-hero-1': 'Landing Hero 1',
					'landing-hero-2': 'Landing Hero 2',
					'blank': 'Blank',
					'browse': 'Custom Template'
				};
				templateName = templateMap[detail.template] || detail.template.charAt(0).toUpperCase() + detail.template.slice(1);
			}
			const projectName = `${templateName} Project`;
			currentProjectId = generateProjectId();
			saveProject(currentProjectId, window.currentEditor, projectName);
			if (typeof showStatusMessage === 'function') showStatusMessage('Project created from template', 'success');
		}
	}
});

document.addEventListener('load-recent-project', function(e) {
	const detail = e.detail || {};
	const placeholder = document.getElementById('canvas');
	// Remove old editor
	while (placeholder.firstChild) placeholder.removeChild(placeholder.firstChild);
	let canvasData = null;
	
	if (detail.id) {
		// Load by project ID (new system)
		canvasData = loadProject(detail.id);
	} else if (detail.data) {
		// Load ccjson data directly (legacy/template support)
		canvasData = detail.data;
	}
	
	if (canvasData) {
		// Load project data into editor
		if (window.miniCanvasEditor && window.miniCanvasEditor.Editor && window.miniCanvasEditor.Editor.createFromJSON) {
			window.miniCanvasEditor.Editor.createFromJSON(canvasData, placeholder, { hand: true }).then((editor) => {
				window.currentEditor = editor;
				if (editor.startAutoLayout) editor.startAutoLayout(true);
				if (typeof applyWheelZoomOverride === 'function') applyWheelZoomOverride(editor);
				if (typeof attachSnapshotListeners === 'function') attachSnapshotListeners(editor);
				if (typeof startAutoSave === 'function') startAutoSave(editor);
				if (typeof setupStatusBarListeners === 'function') setupStatusBarListeners(editor);
				if (editor.onChanged) {
					editor.onChanged.subscribe(() => {
						if (typeof saveCanvasState === 'function' && typeof recording !== 'undefined') {
							clearTimeout(editor._saveTimeout);
							editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
						}
					});
				}
				if (typeof showStatusMessage === 'function') showStatusMessage('Project loaded', 'success');
				// Force canvas refresh to ensure proper centering and rendering
				if (typeof forceCanvasRefresh === 'function') forceCanvasRefresh(editor);
			}).catch(err => {
				console.error('Failed to create editor from project data:', err);
				if (typeof showStatusMessage === 'function') showStatusMessage('Failed to load project', 'error');
			});
		}
	} else if (detail.path) {
		// If path is provided, try to fetch and load
		fetch(detail.path).then(r => r.json()).then(data => {
			if (window.miniCanvasEditor && window.miniCanvasEditor.Editor && window.miniCanvasEditor.Editor.createFromJSON) {
				window.miniCanvasEditor.Editor.createFromJSON(data, placeholder, { hand: true }).then((editor) => {
					window.currentEditor = editor;
					if (editor.startAutoLayout) editor.startAutoLayout(true);
					if (typeof applyWheelZoomOverride === 'function') applyWheelZoomOverride(editor);
					if (typeof attachSnapshotListeners === 'function') attachSnapshotListeners(editor);
					if (typeof startAutoSave === 'function') startAutoSave(editor);
					if (typeof setupStatusBarListeners === 'function') setupStatusBarListeners(editor);
					if (editor.onChanged) {
						editor.onChanged.subscribe(() => {
							if (typeof saveCanvasState === 'function' && typeof recording !== 'undefined') {
								clearTimeout(editor._saveTimeout);
								editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
							}
						});
					}
					if (typeof showStatusMessage === 'function') showStatusMessage('Recent project loaded', 'success');
					// Force canvas refresh to ensure proper centering and rendering
					if (typeof forceCanvasRefresh === 'function') forceCanvasRefresh(editor);
				});
			}
		});
	} else {
		// Try to load from browser localStorage (canvas-editor-state)
		const saved = localStorage.getItem('canvas-editor-state');
		if (saved) {
			try {
				const saveData = JSON.parse(saved);
				if (saveData.canvas && window.miniCanvasEditor && window.miniCanvasEditor.Editor && window.miniCanvasEditor.Editor.createFromJSON) {
					window.miniCanvasEditor.Editor.createFromJSON(saveData.canvas, placeholder, { hand: true }).then((editor) => {
						window.currentEditor = editor;
						if (editor.startAutoLayout) editor.startAutoLayout(true);
						if (typeof applyWheelZoomOverride === 'function') applyWheelZoomOverride(editor);
						if (typeof attachSnapshotListeners === 'function') attachSnapshotListeners(editor);
						if (typeof startAutoSave === 'function') startAutoSave(editor);
						if (typeof setupStatusBarListeners === 'function') setupStatusBarListeners(editor);
						if (editor.onChanged) {
							editor.onChanged.subscribe(() => {
								if (typeof saveCanvasState === 'function' && typeof recording !== 'undefined') {
									clearTimeout(editor._saveTimeout);
									editor._saveTimeout = setTimeout(() => saveCanvasState(editor), 1000);
								}
							});
						}
						if (typeof showStatusMessage === 'function') showStatusMessage('Recent project loaded', 'success');
						// Force canvas refresh to ensure proper centering and rendering
						if (typeof forceCanvasRefresh === 'function') forceCanvasRefresh(editor);
					});
				}
			} catch (err) {
				if (typeof showStatusMessage === 'function') showStatusMessage('Failed to load recent project', 'error');
			}
		}
	}
});

})();
