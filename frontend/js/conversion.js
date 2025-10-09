/*---------------------------------------*/
/* CONVERSION THE SPIRE - JAVASCRIPT     */
/*---------------------------------------*/

class ConversionTheSpire {
    constructor() {
        this.files = new Map();
        this.selectedFormat = '';
        this.conversions = [];
        this.convertedFiles = [];
        this.lastClickTime = 0; // For debouncing file dialog
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.loadPopularConversions();
    }

    setupEventListeners() {
        // File input
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        const uploadBtn = document.querySelector('.c-upload-btn');

        if (fileInput && uploadArea && uploadBtn) {
            // Set accept attribute to prevent unsupported files
            fileInput.accept = "image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip,.rar,.7z,.tar,.gz,.json,.xml,.html,.css,.js,.md";
            
            const openFileDialog = () => {
                const now = Date.now();
                if (now - this.lastClickTime > 1000) { // 1 second debounce
                    this.lastClickTime = now;
                    fileInput.value = ''; // Reset file input to allow same file upload
                    fileInput.click();
                }
            };
            
            uploadBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering uploadArea click
                openFileDialog();
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFiles(e.target.files);
                }
            });
            
            uploadArea.addEventListener('click', openFileDialog);
        }

        // Format selection
        const formatBtns = document.querySelectorAll('.c-format-btn');
        formatBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectFormat(e.target));
        });

        // Convert button
        const convertBtn = document.getElementById('convertBtn');
        if (convertBtn) {
            convertBtn.addEventListener('click', () => this.startConversion());
        }

        // Test connection button
        const testConnectionBtn = document.getElementById('testConnectionBtn');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', () => this.testBackendConnection());
        }

        // Popular conversion cards
        const conversionCards = document.querySelectorAll('.c-conversion-card');
        conversionCards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectPopularConversion(card);
            });
        });

        // Convert Another File button
        const convertAnotherBtn = document.getElementById('convertAnotherBtn');
        if (convertAnotherBtn) {
            convertAnotherBtn.addEventListener('click', () => this.resetConverter());
        }

        // Add conversion format info
        this.showConversionInfo();
        
        // Setup theme toggle - REMOVED to avoid conflict with themeManager.js
    }

    showConversionInfo() {
        // Add a subtle notice about real conversion capabilities
        const heroSubtitle = document.querySelector('.c-hero__subtitle');
        if (heroSubtitle && !document.getElementById('conversion-notice')) {
            const notice = document.createElement('div');
            notice.id = 'conversion-notice';
            notice.style.cssText = `
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                color: var(--text-secondary);
                padding: 8px 16px;
                border-radius: 6px;
                margin-top: 12px;
                text-align: center;
                font-size: 13px;
                opacity: 0.8;
            `;
            notice.innerHTML = `
                <span style="color: var(--primary-color); font-weight: 500;">Professional Conversion</span> 
                powered by FFmpeg & Pillow
            `;
            heroSubtitle.parentNode.insertBefore(notice, heroSubtitle.nextSibling);
        }
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = themeToggle?.querySelector('.theme-icon');
        
        if (!themeToggle || !themeIcon) return;

        // Get current theme
        const getCurrentTheme = () => {
            return document.documentElement.getAttribute('data-theme') || 
                   (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        };

        // Update icon based on theme
        const updateThemeIcon = (theme) => {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
            themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
        };

        // Initialize icon
        updateThemeIcon(getCurrentTheme());

        // Toggle theme
        themeToggle.addEventListener('click', () => {
            const currentTheme = getCurrentTheme();
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            // Apply theme
            document.documentElement.setAttribute('data-theme', newTheme);
            document.body.setAttribute('data-theme', newTheme);
            
            // Save preference
            localStorage.setItem('theme-preference', newTheme);
            
            // Update icon
            updateThemeIcon(newTheme);
            
            // Show notification
            this.showNotification(`Switched to ${newTheme} mode`, 'info');
            
            console.log(`🎨 Theme switched to: ${newTheme}`);
        });

        // Load saved theme preference
        const savedTheme = localStorage.getItem('theme-preference');
        if (savedTheme && savedTheme !== getCurrentTheme()) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            document.body.setAttribute('data-theme', savedTheme);
            updateThemeIcon(savedTheme);
        }
    }

    // Debug function to test backend connectivity
    async testBackendConnection() {
        try {
            console.log('🔍 Testing backend connection...');
            const response = await fetch('https://quizthespire.duckdns.org/', {
                method: 'GET'
            });
            console.log('✅ Backend connection test:', {
                status: response.status,
                statusText: response.statusText
            });
            this.showNotification('Backend connection successful!', 'success');
            return true;
        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            this.showNotification('Backend connection failed! Make sure the server is running on quizthespire.duckdns.org.', 'error');
            return false;
        }
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    handleFiles(fileList) {
        Array.from(fileList).forEach(file => {
            if (this.validateFile(file)) {
                const fileId = this.generateFileId();
                this.files.set(fileId, file);
                this.displayFile(fileId, file);
            }
        });

        this.updateConvertButton();
        this.showFileList();
        this.updateAvailableFormats();
        
        // Show success notification
        const addedCount = Array.from(fileList).filter(file => this.validateFile(file)).length;
        if (addedCount > 0) {
            this.showNotification(`${addedCount} file(s) added successfully`, 'success');
            
            // Scroll to file list to show the added files
            const fileListElement = document.getElementById('fileList');
            if (fileListElement) {
                setTimeout(() => {
                    fileListElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }

    validateFile(file) {
        const maxSize = 1024 * 1024 * 1024; // 1GB
        const allowedTypes = [
            // Documents
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain', 'text/csv', 'application/rtf',
            
            // Images
            'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
            'image/tiff', 'image/x-icon',
            
            // Audio
            'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/mp4',
            
            // Video
            'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm',
            'video/mkv', 'video/m4v',
            
            // Archives
            'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
            'application/x-tar', 'application/gzip',
            
            // Other
            'application/json', 'application/xml', 'text/html', 'text/css', 'text/javascript'
        ];

        if (file.size > maxSize) {
            this.showNotification(`File "${file.name}" is too large. Maximum size is 1GB.`, 'error');
            return false;
        }

        if (!allowedTypes.includes(file.type) && !this.isFileExtensionAllowed(file.name)) {
            this.showNotification(`File type "${file.type}" is not supported.`, 'error');
            return false;
        }

        return true;
    }

    isFileExtensionAllowed(filename) {
        const allowedExtensions = [
            // Documents
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf',
            
            // Images
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif', 'ico',
            
            // Audio
            'mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma',
            
            // Video
            'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp',
            
            // Archives
            'zip', 'rar', '7z', 'tar', 'gz',
            
            // Other
            'json', 'xml', 'html', 'css', 'js', 'md'
        ];

        const extension = filename.split('.').pop().toLowerCase();
        return allowedExtensions.includes(extension);
    }

    generateFileId() {
        return 'file_' + Math.random().toString(36).substr(2, 9);
    }

    getFileCategory(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const mimeType = file.type.toLowerCase();

        // Document formats
        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf'].includes(extension) ||
            mimeType.includes('document') || mimeType.includes('spreadsheet') || mimeType.includes('presentation') ||
            mimeType.includes('text') || mimeType.includes('pdf')) {
            return 'document';
        }
        
        // Image formats
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif', 'ico'].includes(extension) ||
            mimeType.includes('image')) {
            return 'image';
        }
        
        // Audio formats
        if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(extension) ||
            mimeType.includes('audio')) {
            return 'audio';
        }
        
        // Video formats
        if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'].includes(extension) ||
            mimeType.includes('video')) {
            return 'video';
        }
        
        // Archive formats
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension) ||
            mimeType.includes('zip') || mimeType.includes('compressed')) {
            return 'archive';
        }

        return 'other';
    }

    getCompatibleFormats(fileCategories) {
        const compatibilityMap = {
            'document': ['pdf', 'txt', 'rtf', 'csv', 'zip'],
            'image': ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'pdf', 'zip'],
            'audio': ['mp3', 'wav', 'ogg', 'zip'],
            'video': ['mp4', 'webm', 'mp3', 'wav', 'zip'], // Video can convert to audio
            'archive': ['zip', '7z', 'tar'],
            'other': ['txt', 'zip'] // Basic conversions for unknown types
        };

        let allCompatibleFormats = new Set();
        
        fileCategories.forEach(category => {
            if (compatibilityMap[category]) {
                compatibilityMap[category].forEach(format => {
                    allCompatibleFormats.add(format);
                });
            }
        });

        return Array.from(allCompatibleFormats);
    }

    updateAvailableFormats() {
        if (this.files.size === 0) {
            // No files, enable all formats
            document.querySelectorAll('.c-format-btn').forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('disabled');
                btn.title = '';
            });
            return;
        }

        // Get categories of all uploaded files
        const fileCategories = new Set();
        this.files.forEach(file => {
            fileCategories.add(this.getFileCategory(file));
        });

        const compatibleFormats = this.getCompatibleFormats(Array.from(fileCategories));
        
        // Update format buttons
        document.querySelectorAll('.c-format-btn').forEach(btn => {
            const format = btn.textContent.trim().toLowerCase();
            const isCompatible = compatibleFormats.includes(format);
            
            if (isCompatible) {
                btn.disabled = false;
                btn.classList.remove('disabled');
                btn.title = '';
            } else {
                btn.disabled = true;
                btn.classList.add('disabled');
                btn.title = 'This format is not compatible with your uploaded files';
                
                // Remove selection if currently selected incompatible format
                if (btn.classList.contains('selected')) {
                    btn.classList.remove('selected');
                    this.selectedFormat = '';
                    this.updateConvertButton();
                }
            }
        });
    }

    displayFile(fileId, file) {
        const fileItems = document.getElementById('fileItems');
        if (!fileItems) return;

        const fileItem = document.createElement('div');
        fileItem.className = 'c-file-item';
        fileItem.dataset.fileId = fileId;

        fileItem.innerHTML = `
            <div class="c-file-info">
                <div class="c-file-name">${file.name}</div>
                <div class="c-file-size">${this.formatFileSize(file.size)}</div>
            </div>
            <button class="c-file-remove" onclick="conversionSpire.removeFile('${fileId}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
            </button>
        `;

        fileItems.appendChild(fileItem);
    }

    removeFile(fileId) {
        this.files.delete(fileId);
        const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileItem) {
            fileItem.remove();
        }

        if (this.files.size === 0) {
            this.hideFileList();
        }

        this.updateConvertButton();
        this.updateAvailableFormats();
    }

    showFileList() {
        const fileList = document.getElementById('fileList');
        const conversionOptions = document.getElementById('conversionOptions');
        if (fileList) {
            fileList.style.display = 'block';
        }
        if (conversionOptions) {
            conversionOptions.style.display = 'block';
        }
    }

    hideFileList() {
        const fileList = document.getElementById('fileList');
        const conversionOptions = document.getElementById('conversionOptions');
        if (fileList) {
            fileList.style.display = 'none';
        }
        if (conversionOptions) {
            conversionOptions.style.display = 'none';
        }
    }

    selectFormat(button) {
        // Remove active class from all format buttons
        document.querySelectorAll('.c-format-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Add active class to selected button
        button.classList.add('selected');
        this.selectedFormat = button.textContent.trim().toLowerCase();

        // Check for same-format conversions and show warning
        this.validateFormatSelection();
        
        this.updateConvertButton();
    }

    validateFormatSelection() {
        if (!this.selectedFormat || this.files.size === 0) return;

        let sameFormatCount = 0;
        const sameFormatFiles = [];

        for (const [fileId, file] of this.files.entries()) {
            const currentFormat = this.getFileExtension(file.name).toLowerCase();
            if (currentFormat === this.selectedFormat) {
                sameFormatCount++;
                sameFormatFiles.push(file.name);
            }
        }

        if (sameFormatCount > 0) {
            const message = sameFormatCount === 1 ? 
                `"${sameFormatFiles[0]}" is already in ${this.selectedFormat.toUpperCase()} format` :
                `${sameFormatCount} files are already in ${this.selectedFormat.toUpperCase()} format`;
            
            this.showNotification(`⚠️ ${message}. These files will be skipped to save bandwidth.`, 'warning');
        }
    }

    getFileExtension(filename) {
        return filename.split('.').pop() || '';
    }

    selectPopularConversion(card) {
        const fromFormat = card.querySelector('.c-format-from').textContent.toLowerCase();
        const toFormat = card.querySelector('.c-format-to').textContent.toLowerCase();
        
        // Show conversion options
        const conversionOptions = document.getElementById('conversionOptions');
        if (conversionOptions) {
            conversionOptions.style.display = 'block';
        }
        
        // Auto-select the target format
        const formatBtn = document.querySelector(`.c-format-btn[data-format="${toFormat}"]`);
        if (formatBtn) {
            this.selectFormat(formatBtn);
        }

        // Scroll to converter
        document.querySelector('.c-converter').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });

        // Show notification about popular conversion selection
        this.showNotification(`Selected ${fromFormat.toUpperCase()} to ${toFormat.toUpperCase()} conversion. Now upload your files!`, 'success');
    }

    updateConvertButton() {
        const convertBtn = document.getElementById('convertBtn');
        if (!convertBtn) return;

        const hasFiles = this.files.size > 0;
        const hasFormat = this.selectedFormat !== '';

        convertBtn.disabled = !(hasFiles && hasFormat);
        
        if (hasFiles && hasFormat) {
            convertBtn.textContent = `Convert to ${this.selectedFormat.toUpperCase()}`;
        } else if (hasFiles) {
            convertBtn.textContent = 'Select Output Format';
        } else {
            convertBtn.textContent = 'Add Files to Convert';
        }
    }

    async startConversion() {
        if (this.files.size === 0 || !this.selectedFormat) {
            this.showNotification('Please select files and output format', 'error');
            return;
        }

        this.showProgress();
        
        try {
            await this.performRealConversion();
        } catch (error) {
            console.error('Conversion error:', error);
            this.showNotification('Conversion failed. Please try again.', 'error');
            document.getElementById('conversionProgress').style.display = 'none';
        }
    }

    showProgress() {
        const progressSection = document.getElementById('conversionProgress');
        if (progressSection) {
            progressSection.style.display = 'block';
        }

        this.updateProgress(0, 'Preparing files for conversion...');
    }

    updateProgress(percentage, message) {
        const progressFill = document.querySelector('.c-progress-fill');
        const progressText = document.querySelector('.c-progress-text');

        if (progressFill) {
            progressFill.style.width = percentage + '%';
        }

        if (progressText) {
            progressText.textContent = message;
        }
    }

    updateDetailedProgress(totalToConvert, skippedCount) {
        const progressSection = document.getElementById('conversionProgress');
        if (!progressSection) return;

        // Create detailed progress section if it doesn't exist
        let detailsSection = progressSection.querySelector('.conversion-details');
        if (!detailsSection) {
            detailsSection = document.createElement('div');
            detailsSection.className = 'conversion-details';
            detailsSection.innerHTML = `
                <div class="conversion-summary">
                    <span class="files-to-convert">📁 ${totalToConvert} files to convert</span>
                    ${skippedCount > 0 ? `<span class="files-skipped">⏭️ ${skippedCount} files skipped (same format)</span>` : ''}
                </div>
                <div class="current-file-status"></div>
            `;
            progressSection.appendChild(detailsSection);
        }
    }

    updateCurrentFileProgress(fileName, status) {
        const statusElement = document.querySelector('.current-file-status');
        if (!statusElement) return;

        const statusIcons = {
            'converting': '🔄',
            'completed': '✅', 
            'failed': '❌'
        };

        const statusTexts = {
            'converting': 'Converting...',
            'completed': 'Completed',
            'failed': 'Failed'
        };

        statusElement.innerHTML = `
            <div class="file-progress-item ${status}">
                ${statusIcons[status]} <strong>${fileName}</strong> - ${statusTexts[status]}
            </div>
        `;

        // Auto-scroll to show current progress
        statusElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async performRealConversion() {
        this.updateProgress(5, 'Analyzing files...');
        
        const convertedFiles = [];
        const skippedFiles = [];
        let processedCount = 0;
        
        // Filter out files that are already in target format
        const filesToConvert = [];
        for (const [fileId, file] of this.files.entries()) {
            const currentFormat = this.getFileExtension(file.name).toLowerCase();
            if (currentFormat === this.selectedFormat) {
                skippedFiles.push(file.name);
            } else {
                filesToConvert.push(file);
            }
        }
        
        const totalToConvert = filesToConvert.length;
        
        if (totalToConvert === 0) {
            this.updateProgress(100, 'No files need conversion - all are already in target format!');
            if (skippedFiles.length > 0) {
                this.showNotification(`All ${skippedFiles.length} files are already in ${this.selectedFormat.toUpperCase()} format`, 'info');
            }
            setTimeout(() => this.showResults(), 1000);
            return;
        }
        
        this.updateProgress(10, `Converting ${totalToConvert} files...`);
        
        // Show detailed progress section
        this.updateDetailedProgress(totalToConvert, skippedFiles.length);
        
        for (let i = 0; i < filesToConvert.length; i++) {
            const file = filesToConvert[i];
            try {
                const progressPercent = 15 + (i / totalToConvert) * 75;
                this.updateProgress(
                    progressPercent, 
                    `Converting file ${i + 1} of ${totalToConvert}: ${file.name}`
                );
                
                this.updateCurrentFileProgress(file.name, 'converting');
                
                // Send file to backend for real conversion
                const convertedBlob = await this.convertFileOnBackend(file, this.selectedFormat);
                
                if (convertedBlob) {
                    const originalName = file.name;
                    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                    const convertedName = `${baseName}.${this.selectedFormat}`;
                    
                    convertedFiles.push({
                        name: convertedName,
                        blob: convertedBlob,
                        originalFile: file
                    });
                    
                    this.updateCurrentFileProgress(file.name, 'completed');
                    console.log(`✅ ${file.name} converted successfully!`);
                } else {
                    this.updateCurrentFileProgress(file.name, 'failed');
                }
                
                processedCount++;
            } catch (error) {
                console.error(`Error converting ${file.name}:`, error);
                this.updateCurrentFileProgress(file.name, 'failed');
                this.showNotification(`❌ Error converting ${file.name}: ${error.message}`, 'error');
                processedCount++;
            }
        }
        
        this.updateProgress(95, 'Finalizing conversions...');
        
        // Store converted files for download
        this.convertedFiles = convertedFiles;
        this.skippedFiles = skippedFiles;
        
        this.updateProgress(100, `Conversion complete! ${convertedFiles.length} files converted, ${skippedFiles.length} skipped.`);
        
        setTimeout(() => {
            this.showResults();
        }, 1000);
    }

    async convertFileOnBackend(file, targetFormat) {
        try {
            console.log(`🔄 Starting conversion: ${file.name} → ${targetFormat.toUpperCase()}`);
            
            // Create FormData to send file to backend
            const formData = new FormData();
            formData.append('file', file);
            formData.append('target_format', targetFormat);
            
            console.log('📤 Sending file to backend...', {
                fileName: file.name,
                fileSize: file.size,
                targetFormat: targetFormat
            });

            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 600000); // 10 minute timeout
            
            // Start progress simulation for long operations
            const progressPromise = this.simulateProgress(controller);
            
            try {
                // Send to backend conversion endpoint
                const backendUrl = 'http://127.0.0.1:8001/api/v1/convert/upload';
                console.log('🔗 Using backend URL:', backendUrl);
                const response = await fetch(backendUrl, {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal
                });

                // Clear timeout
                clearTimeout(timeoutId);
                
                console.log('📥 Backend response:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ Backend error response:', errorText);
                    throw new Error(`Backend conversion failed (${response.status}): ${errorText}`);
                }
                
                // Get the converted file as blob
                const convertedBlob = await response.blob();
                console.log('✅ Conversion successful!', {
                    originalSize: file.size,
                    convertedSize: convertedBlob.size,
                    blobType: convertedBlob.type
                });
                
                // Stop progress simulation
                clearTimeout(timeoutId);
                controller.abort();
                
                return convertedBlob;
                
            } catch (fetchError) {
                clearTimeout(timeoutId);
                controller.abort(); // Stop progress simulation
                
                if (fetchError.name === 'AbortError') {
                    throw new Error('Conversion timed out after 10 minutes. Please try with a smaller file.');
                }
                throw fetchError;
            }
            
        } catch (error) {
            console.error('💥 Backend conversion error:', error);
            
            // Check for network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to conversion server. Please check if the backend is running on quizthespire.duckdns.org.');
            }
            
            // Check for specific error types
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error: Cannot reach conversion server at quizthespire.duckdns.org');
            }
            
            // Check for FFmpeg audio conversion errors
            if (error.message.includes('encoder setup failed') || error.message.includes('Error while opening encoder')) {
                if (targetFormat.toLowerCase() === 'ogg') {
                    throw new Error('Audio conversion failed: This audio file has an unsupported sample rate or format for OGG conversion. Try converting to MP3 or WAV instead, or use a different source file with standard audio parameters (44.1kHz or 48kHz sample rate).');
                } else {
                    throw new Error(`Audio conversion failed: The audio file format is not compatible with ${targetFormat.toUpperCase()} conversion. Try a different output format or check the source file.`);
                }
            }
            
            // Check for other FFmpeg errors
            if (error.message.includes('FFmpeg failed')) {
                throw new Error('Conversion failed: The file format or parameters are not supported. Please try a different file or output format.');
            }
            
            throw new Error(`Conversion failed: ${error.message}`);
        }
    }

    // All file conversion now happens on the backend
    // The convertFileOnBackend method handles sending files to the server

    showResults() {
        // Hide progress section
        const progressSection = document.getElementById('conversionProgress');
        if (progressSection) {
            progressSection.style.display = 'none';
        }

        const resultsSection = document.getElementById('conversionResults');
        const resultsList = document.getElementById('resultsList');
        
        if (!resultsSection || !resultsList) return;

        // Clear previous results
        resultsList.innerHTML = '';

        // Add summary section
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'conversion-summary-results';
        
        const convertedCount = this.convertedFiles ? this.convertedFiles.length : 0;
        const skippedCount = this.skippedFiles ? this.skippedFiles.length : 0;
        
        summaryDiv.innerHTML = `
            <h4>Conversion Summary</h4>
            <div class="summary-stats">
                <span class="stat-item success">✅ ${convertedCount} files converted</span>
                ${skippedCount > 0 ? `<span class="stat-item skipped">⏭️ ${skippedCount} files skipped (same format)</span>` : ''}
            </div>
        `;
        resultsList.appendChild(summaryDiv);

        // Generate result items for each converted file
        if (this.convertedFiles && this.convertedFiles.length > 0) {
            const downloadAllBtn = document.createElement('button');
            downloadAllBtn.className = 'c-btn c-btn--primary download-all-btn';
            downloadAllBtn.textContent = `Download All ${convertedCount} Files`;
            downloadAllBtn.onclick = () => this.downloadAllFiles();
            resultsList.appendChild(downloadAllBtn);

            this.convertedFiles.forEach((convertedFile, index) => {
                const resultItem = this.createRealResultItem(convertedFile, index);
                resultsList.appendChild(resultItem);
            });

            // Show skipped files if any
            if (this.skippedFiles && this.skippedFiles.length > 0) {
                const skippedDiv = document.createElement('div');
                skippedDiv.className = 'skipped-files-section';
                skippedDiv.innerHTML = `
                    <h5>Skipped Files (Already in ${this.selectedFormat.toUpperCase()} format)</h5>
                    <div class="skipped-files-list">
                        ${this.skippedFiles.map(name => `<span class="skipped-file">📄 ${name}</span>`).join('')}
                    </div>
                `;
                resultsList.appendChild(skippedDiv);
            }

            resultsSection.style.display = 'block';

            // Show success notification
            const message = skippedCount > 0 ? 
                `Successfully converted ${convertedCount} files, skipped ${skippedCount} files (same format)` :
                `Successfully converted ${convertedCount} file(s) to ${this.selectedFormat.toUpperCase()}`;
            this.showNotification(message, 'success');
        } else {
            if (skippedCount > 0) {
                this.showNotification(`No files converted - all ${skippedCount} files were already in ${this.selectedFormat.toUpperCase()} format`, 'info');
            } else {
                this.showNotification('No files were converted successfully', 'error');
            }
        }
    }

    createRealResultItem(convertedFile, index) {
        const resultItem = document.createElement('div');
        resultItem.className = 'c-result-item';

        resultItem.innerHTML = `
            <div class="c-file-info">
                <div class="c-file-name">${convertedFile.name}</div>
                <div class="c-file-size">${this.formatFileSize(convertedFile.blob.size)}</div>
            </div>
            <button class="c-btn c-btn--primary c-btn--sm" onclick="conversionSpire.downloadConvertedFile(${index})">
                Download
            </button>
        `;

        return resultItem;
    }

    downloadAllFiles() {
        if (!this.convertedFiles || this.convertedFiles.length === 0) {
            this.showNotification('No files available for download', 'error');
            return;
        }

        // Download each file with a small delay to avoid browser blocking
        this.convertedFiles.forEach((file, index) => {
            setTimeout(() => {
                this.downloadConvertedFile(index);
            }, index * 200); // 200ms delay between downloads
        });

        this.showNotification(`Downloading ${this.convertedFiles.length} files...`, 'info');
    }

    downloadConvertedFile(index) {
        if (!this.convertedFiles || !this.convertedFiles[index]) {
            this.showNotification('File not found for download', 'error');
            return;
        }

        const convertedFile = this.convertedFiles[index];
        
        try {
            // Create download link
            const url = URL.createObjectURL(convertedFile.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = convertedFile.name;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up the URL object
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            this.showNotification(`${convertedFile.name} downloaded successfully!`, 'success');
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Download failed. Please try again.', 'error');
        }
    }

    // Legacy method for compatibility
    downloadFile(filename) {
        this.showNotification(`Looking for file: ${filename}`, 'info');
        
        // Try to find the converted file by name
        const fileIndex = this.convertedFiles?.findIndex(f => f.name === filename);
        if (fileIndex >= 0) {
            this.downloadConvertedFile(fileIndex);
        } else {
            this.showNotification('File not found for download', 'error');
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `c-notification c-notification--${type}`;
        notification.innerHTML = `
            <div class="c-notification__content">
                <span class="c-notification__message">${message}</span>
                <button class="c-notification__close">&times;</button>
            </div>
        `;

        // Add styles if not already added
        this.addNotificationStyles();

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // Close button functionality
        const closeBtn = notification.querySelector('.c-notification__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => notification.remove());
        }

        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
    }

    addNotificationStyles() {
        if (document.querySelector('#notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .c-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 400px;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                color: white;
            }

            .c-notification.show {
                transform: translateX(0);
            }

            .c-notification--info {
                background-color: #3b82f6;
            }

            .c-notification--success {
                background-color: #10b981;
            }

            .c-notification--error {
                background-color: #ef4444;
            }

            .c-notification__content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            }

            .c-notification__message {
                flex: 1;
            }

            .c-notification__close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                opacity: 0.8;
            }

            .c-notification__close:hover {
                opacity: 1;
            }
        `;

        document.head.appendChild(style);
    }

    loadPopularConversions() {
        // This could be expanded to load real conversion statistics
        console.log('Popular conversions loaded');
    }

    // Footer link navigation
    scrollToFormatCategory(category) {
        const formatCategories = document.querySelectorAll('.c-format-category');
        let targetCategory = null;

        formatCategories.forEach(cat => {
            const title = cat.querySelector('h4').textContent.toLowerCase();
            if (title.includes(category.toLowerCase())) {
                targetCategory = cat;
            }
        });

        if (targetCategory) {
            targetCategory.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Show the conversion options if they're hidden
            const conversionOptions = document.getElementById('conversionOptions');
            if (conversionOptions && conversionOptions.style.display === 'none') {
                conversionOptions.style.display = 'block';
            }
        }
    }

    // Reset the converter for another conversion
    resetConverter() {
        // Clear files
        this.files.clear();
        this.convertedFiles = [];
        
        // Hide sections
        this.hideFileList();
        document.getElementById('conversionProgress').style.display = 'none';
        document.getElementById('conversionResults').style.display = 'none';
        
        // Clear file items
        const fileItems = document.getElementById('fileItems');
        if (fileItems) {
            fileItems.innerHTML = '';
        }
        
        // Clear results
        const resultsList = document.getElementById('resultsList');
        if (resultsList) {
            resultsList.innerHTML = '';
        }
        
        // Reset format selection
        document.querySelectorAll('.c-format-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        this.selectedFormat = '';
        
        // Update convert button and available formats
        this.updateConvertButton();
        this.updateAvailableFormats();
        
        this.showNotification('Ready for new conversion!', 'info');
    }

    // Analytics and SEO tracking
    trackConversion(fromFormat, toFormat) {
        // Track conversion for analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion', {
                'from_format': fromFormat,
                'to_format': toFormat,
                'event_category': 'file_conversion'
            });
        }
    }

    trackPopularConversionClick(conversionType) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'popular_conversion_click', {
                'conversion_type': conversionType,
                'event_category': 'engagement'
            });
        }
    }

    // Progress simulation for long-running conversions
    simulateProgress(abortController, totalFiles = 1) {
        return new Promise((resolve) => {
            let progress = 0;
            const progressMessages = [
                'Initializing conversion...',
                'Analyzing file formats...',
                'Processing files...',
                'Converting audio/video streams...',
                'Optimizing output quality...',
                'Finalizing conversion...',
                'Almost done...'
            ];

            const updateProgressStep = () => {
                if (abortController.signal.aborted) {
                    resolve();
                    return;
                }

                progress += Math.random() * 15 + 5; // Random progress increment
                if (progress > 90) progress = 90; // Cap at 90% until real completion

                const messageIndex = Math.floor((progress / 100) * (progressMessages.length - 1));
                const message = progressMessages[messageIndex] || 'Processing...';
                
                this.updateProgress(Math.floor(progress), message);

                if (progress < 90) {
                    setTimeout(updateProgressStep, 1000 + Math.random() * 2000); // 1-3 second intervals
                } else {
                    resolve();
                }
            };

            setTimeout(updateProgressStep, 500);
        });
    }
}

// Initialize the conversion application
let conversionSpire;

document.addEventListener('DOMContentLoaded', function() {
    conversionSpire = new ConversionTheSpire();
    
    // Add format data attributes for easier selection
    document.querySelectorAll('.c-format-btn').forEach(btn => {
        const format = btn.textContent.trim().toLowerCase();
        btn.setAttribute('data-format', format);
    });
    
    // Set up theme detection for better user experience
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
});

// Export for global access
window.ConversionTheSpire = ConversionTheSpire;

// Global functions for HTML inline onclick handlers
window.scrollToFormatCategory = function(category) {
    if (conversionSpire) {
        conversionSpire.scrollToFormatCategory(category);
    }
};

window.quickConvert = function(fromFormat, toFormat) {
    if (conversionSpire) {
        // Auto-select the target format
        const formatBtn = document.querySelector(`.c-format-btn[data-format="${toFormat}"]`);
        if (formatBtn) {
            conversionSpire.selectFormat(formatBtn);
        }
        
        // Scroll to converter
        document.querySelector('.c-converter').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        
        conversionSpire.showNotification(`Ready to convert ${fromFormat.toUpperCase()} to ${toFormat.toUpperCase()}`, 'info');
    }
};

// Legal sections tab functionality
window.showLegalTab = function(tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.c-legal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.c-legal-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-content`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    // Scroll to the legal sections
    const legalSection = document.querySelector('.c-legal-sections');
    if (legalSection) {
        legalSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
};

// Initialize legal tabs functionality
document.addEventListener('DOMContentLoaded', function() {
    // Set up tab click handlers
    document.querySelectorAll('.c-legal-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            showLegalTab(tabName);
        });
    });
});