const knox     = require('knox');
const fs       = require('fs');
const dir      = require('node-dir');
const humanize = require('humanize');
const classie  = require('classie');

const App = {
  /**
   * Initialize dom element getters
   * Set up S3 client
   * Decide which screen to show
   */
  init() {
    this.dropzone     = document.getElementById('dropzone');
    this.getname      = document.getElementById('getname');
    this.wrapper      = document.getElementById('wrapper');
    this.progressInfo = document.getElementById('progressInfo');
    this.percent      = document.getElementById('percent');
    this.button       = document.getElementById('fancyButton');
    this.fileList     = document.getElementById('fileList');
    this.title        = document.querySelector('#dropzone h1');
    this.confirm      = document.getElementById('confirm');
    this.fileNum      = document.getElementById('filenum');
    this.fileSize     = document.getElementById('filesize');

    this.concurrentDownloads = 100;

    if (localStorage.getItem('username')) {
      this.username = localStorage.getItem('username');
    } else {
      this.username = false;
    }

    this.setUpS3();
    this.show();
  },

  /**
   * Set up the S3 client from environment variables
   */
  setUpS3() {
    this.client = knox.createClient({
        key: process.env.AWS_S3_KEY
      , secret: process.env.AWS_S3_SECRET
      , bucket: process.env.AWS_S3_BUCKET
    });
  },

  /**
   * If there is a username saved, show the dropzone section
   * otherwise show the getname section
   */
  show() {
    if (this.username) {
      classie.remove(this.getname, 'show');
      classie.add(this.dropzone  , 'show');
      classie.add(this.wrapper   , 'dropzone');
      this.setDropzone();
    } else {
      classie.remove(this.dropzone, 'show');
      classie.add(this.getname    , 'show');
      classie.remove(this.wrapper, 'dropzone');
      this.setGetname();
    }
  },

  /**
   * Set getname section, listen to event when user
   * inputs its username and save it to localStorage
   */
  setGetname() {
    this.button = document.getElementById('save');
    this.input  = document.getElementById('username');

    this.button.addEventListener('click', () => {
      if (this.input.value !== '') {
        localStorage.setItem('username', this.input.value);
        this.username = this.input.value;
        this.show();
      }
    });
  },

  /**
   * Reset app state and uiButton
   */
  resetState() {
    this.state = {
      files    : {}
    , startTime: new Date()
    , totalSize: 0
    };

    //this.progressBar.style.width = 0;
    this.progressInfo.innerHTML = '';
    this.percent.innerHTML = '';

    if (typeof this.uiButton.clear === 'function') {
      this.uiButton.clear();
    }
  },

  /**
   * Create UI Progress button
   * Add listeners for the file drop
   */
  setDropzone() {
    this.uiButton = new UIProgressButton(this.button, {
      callback : ( instance ) => {
        this.uiButton = instance;
        this.uploadFiles();
      }
    });

    this.wrapper.addEventListener('dragenter', () => classie.add(this.wrapper, 'enter'));
    this.wrapper.addEventListener('dragover', (e) => e.preventDefault());
    this.wrapper.addEventListener('drop', (e) => {
      e.preventDefault();

      classie.remove(this.wrapper, 'enter');

      let files = e.target.files || e.dataTransfer.files;

      console.log('Drop', files);

      this.resetState();

      this.addFiles(files);

      this.renderFileList();

      this.genfiles = this.files();

      classie.add(this.title, 'hide');
      classie.add(this.confirm, 'show');
      classie.add(this.button, 'show');

      return false;
    });
  },

  /**
   * Render list of files
   */
  renderFileList() {
    this.fileList.innerHTML = '';

    let keys = Object.keys(this.state.files);
    let size = 0;

    keys.forEach((name) => {
      let file = this.state.files[name];
      size += file.size;
      let li = document.createElement('li');
      li.innerHTML = `<span class="file-name">${name}</span>\
                      <small>${humanize.filesize(file.size)}</small>\
                      <span class="file-progress"></span>`;
      li.id = encodeURIComponent(name);
      this.fileList.appendChild(li);
    });

    this.fileNum.innerHTML = keys.length;
    this.fileSize.innerHTML = humanize.filesize(size);
  },

  /**
   * Update file list item with the current progress
   *
   * @param  {Object} file File object
   */
  updateFile(file) {
    let li = document.getElementById(encodeURIComponent(file.name));

    let progress = li.querySelector('.file-progress');
    let percent = (file.written / file.size) * 100;

    progress.style.width = `${percent}%`;

    if (file.failed) {
      classie.add(progress, 'failed');
    }
  },

  /**
   * Add file to file list
   * if its not a thumbnail file
   * if its a directory call addDir
   *
   * @param {String} name File name
   * @param {String} size File size
   * @param {String} path File path
   */
  addFile(name, size, path) {
    let file = {
      name       : name
    , size       : size
    , path       : path
    , written    : 0
    , completed  : false
    , failed     : false
    , downloading: false
    };

    if (! this.username) return;

    if (file.name.indexOf('.DS_Store') !== -1 || file.name.indexOf('Thumbs.db') !== -1) return;

    if (fs.lstatSync(file.path).isDirectory()) {
      this.addDir(file);
      return;
    }

    this.state.files[file.name] = file;
  },

  /**
   * Add files to file list
   * @param {FileList} files FileLit object from the drop
   */
  addFiles(files) {
    for (var i = 0; i < files.length; i++) {
      let file = files[i];
      this.addFile(file.name, file.size, file.path);
    }
  },

  /**
   * Add files on a directory to file list
   * @param {Object} file File object which is a dir
   */
  addDir(file) {
    dir.files(file.path, (err, files) => {
      if (err) throw err;

      files.forEach((path) => {
        let stat = fs.lstatSync(path);
        let name = this.getName(path);

        this.addFile(name, stat.size, path);
      });

      this.renderFileList();
    });
  },

  /**
   * Start up the uploading of the files with the first batch
   * we only download X files at the same time
   * where X is defined on this.concurrentDownloads
   */
  uploadFiles() {
    let keys = Object.keys(this.state.files);

    for(let i = 0; i < this.concurrentDownloads; i++ ) {
      this.uploadNext();
    }
  },

  /**
   * Files generator
   * See https://davidwalsh.name/es6-generators
   *
   * @return [Generator]
   **/
  *files() {
    let keys = Object.keys(this.state.files);

    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      let file = this.state.files[key];

      if (i === keys.length -1) {
        return file;
      }

      yield file;
    }
  },

  /**
   * Uploads next file returned by the generator
   * Unless it's done and has no value on which case it stops
   */
  uploadNext() {
    let next = this.genfiles.next();

    if (next.done && typeof next.value === 'undefined') return;

    this.uploadFile(next.value);
  },

  /**
   * Returns how many files have been finished
   * either completed or failed
   * @return {Int} Number of completed files
   */
  allCompleted() {
    let keys = Object.keys(this.state.files);

    return keys.reduce((previous, key) => {
            return previous && (this.state.files[key].completed || this.state.files[key].failed);
          }, true);
  },

  /**
   * Returns how many files are in a downlading state
   * at any given time
   * @return {Int} Number of files downloading
   */
  downloading() {
    let keys = Object.keys(this.state.files);

    return keys.reduce((previous, key) => {
            let completed = (this.state.files[key].completed || this.state.files[key].failed);
            return previous + (!completed && this.state.files[key].downloading ? 1 : 0);
          }, 0);
  },

  /**
   * Uploads a file and handles its completion
   * Also tracks the progress of the file
   *
   * On completion marks the file as completed or failed
   * Then checks how many files are downloading, if its less
   * than the concurrentDownloads then call uploadNext
   *
   * If all files have been completed, call this.completed()
   *
   * @param  {Object} file File object
   */
  uploadFile(file) {
    console.log('Upload', file);
    file.downloading = true;

    let awsPath = this.username.trim().replace(' ', '-') + '/' + file.name.trim().replace(' ', '-');

    let req = this.client.putFile(file.path, awsPath, (err, res) => {
      if (err) {
        file.failed = true;
        console.error(err);
      } else {
        file.completed = true;
      }

      file.downloading = false;

      let downloading = this.downloading();

      console.log('downloading: ', downloading);

      if (downloading < this.concurrentDownloads) {
        this.uploadNext();
      }

      this.updateFile(file);

      let completed = this.allCompleted();

      console.log('Completed?', completed);

      if (completed) {
        this.completed();
      }
    });

    req.on('progress', (e) => {
      file.written = e.written;
      this.updateFile(file);
      this.updateProgress();
    });
  },

  /**
   * Update the overall progress when something changed
   * This includes the info text and the progress on the uiButton
   */
  updateProgress() {
    let keys = Object.keys(this.state.files);

    let totalSize = keys.reduce((previous, key) => {
                      return previous + this.state.files[key].size;
                    }, 0);

    let completedSize = keys.reduce((previous, key) => {
                          return previous + this.state.files[key].written;
                        }, 0);

    let raw = (completedSize / totalSize);

    let percent = (raw * 100).toFixed(2);

    let secsElapsed = (new Date() - this.state.startTime) / 1000;

    let speed = completedSize / secsElapsed;

    this.uiButton.setProgress(raw.toFixed(4));
    this.percent.innerHTML = `${percent}%`;

    let text = humanize.filesize(completedSize);
    text += ' de ';
    text += humanize.filesize(totalSize);
    text += ' - ';
    text += humanize.filesize(speed) + '/s';
    text += ' - ( '
    text += secsElapsed.toFixed(2);
    text += ' secs )';

    this.progressInfo.innerHTML = text;
  },

  /**
   * Once all files have been completed, check if
   * all of them have been successful or not and update
   * the uiButton accordingly
   */
  completed() {
    let keys = Object.keys(this.state.files);

    let allSuccess =  keys.reduce((previous, key) => {
                        return previous && this.state.files[key].completed;
                      }, true);

    if (allSuccess) {
      this.uiButton.stop(1);
    } else {
      this.uiButton.stop(-1);
    }
  },

  /**
   * Get the name of a file from a path
   * @param  {String} path Path of the file
   * @return {String}      Name of the file
   */
  getName(path) {
    return path.split('/').slice(-1)[0];
  }
};

App.init();
