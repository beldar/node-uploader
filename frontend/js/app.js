const knox     = require('knox');
const fs       = require('fs');
const dir      = require('node-dir');
const humanize = require('humanize');
const classie  = require('classie');

const App = {
  init() {
    this.dropzone     = document.getElementById('dropzone');
    this.getname      = document.getElementById('getname');
    this.wrapper      = document.getElementById('wrapper');
    //this.progressBar  = document.getElementById('progress');
    this.progressInfo = document.getElementById('progressInfo');
    this.percent      = document.getElementById('percent');
    this.button       = document.getElementById('fancyButton');
    this.fileList     = document.getElementById('fileList');
    this.title        = document.querySelector('#dropzone h1');
    this.confirm      = document.getElementById('confirm');
    this.fileNum      = document.getElementById('filenum');
    this.fileSize     = document.getElementById('filesize');

    if (localStorage.getItem('username')) {
      this.username = localStorage.getItem('username');
    } else {
      this.username = false;
    }

    this.setUpS3();
    this.show();
  },

  setUpS3() {
    this.client = knox.createClient({
        key: process.env.AWS_S3_KEY
      , secret: process.env.AWS_S3_SECRET
      , bucket: process.env.AWS_S3_BUCKET
    });
  },

  show() {
    if (this.username) {
      classie.remove(this.getname, 'show');
      classie.add(this.dropzone  , 'show');
      classie.add(this.wrapper   , 'dropzone');
      this.setDropzone();
    } else {
      classie.remove(this.dropzone, 'show');
      classie.add(this.getname    , 'show');
      classsie.remove(this.wrapper, 'dropzone');
      this.setGetname();
    }
  },

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

  resetState() {
    this.state = {
      files    : {}
    , startTime: new Date()
    , totalSize: 0
    };

    //this.progressBar.style.width = 0;
    this.progressInfo.innerHTML = '';
    this.percent.innerHTML = '';
  },

  setDropzone() {
    new UIProgressButton(this.button, {
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

      classie.add(this.title, 'hide');
      classie.add(this.confirm, 'show');
      classie.add(this.button, 'show');

      return false;
    });
  },

  renderFileList() {
    this.fileList.innerHTML = '';

    let keys = Object.keys(this.state.files);
    let size = 0;

    keys.forEach((name) => {
      let file = this.state.files[name];
      size += file.size;
      let li = document.createElement('li');
      li.innerHTML = name + '<small>' + humanize.filesize(file.size) + '</small><span class="file-progress"></span>';
      li.id = encodeURIComponent(name);
      this.fileList.appendChild(li);
    });

    this.fileNum.innerHTML = keys.length;
    this.fileSize.innerHTML = humanize.filesize(size);
  },

  updateFile(file) {
    let li = document.getElementById(encodeURIComponent(file.name));

    let progress = li.querySelector('.file-progress');
    let percent = (file.written / file.size) * 100;

    progress.style.width = `${percent}%`;

    if (file.failed) {
      classie.add(progress, 'failed');
    }
  },

  addFile(name, size, path) {
    let file = {
      name     : name
    , size     : size
    , path     : path
    , written  : 0
    , completed: false
    , failed   : false
    };

    if (! this.username) return;

    if (file.name.indexOf('.DS_Store') !== -1 || file.name.indexOf('Thumbs.db') !== -1) return;

    if (fs.lstatSync(file.path).isDirectory()) {
      this.addDir(file);
      return;
    }

    this.state.files[file.name] = file;
  },

  addFiles(files) {
    for (var i = 0; i < files.length; i++) {
      let file = files[i];
      this.addFile(file.name, file.size, file.path);
    }
  },

  addDir(file) {
    console.log('uploadDir', file);

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

  uploadFiles() {
    let keys = Object.keys(this.state.files);

    keys.forEach((key) => {
      let file = this.state.files[key];
      this.uploadFile(file);
    });
  },

  allCompleted() {
    let keys = Object.keys(this.state.files);

    return keys.reduce((previous, key) => {
            return previous && (this.state.files[key].completed || this.state.files[key].failed);
          }, true);
  },

  uploadFile(file) {
    let awsPath = this.username.trim().replace(' ', '-') + '/' + file.name.trim().replace(' ', '-');

    let req = this.client.putFile(file.path, awsPath, (err, res) => {
      if (err) {
        file.failed = true;
        console.error(err);
      } else {
        file.completed = true;
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

  updateProgress() {
    let keys = Object.keys(this.state.files);

    let total = keys.reduce((previous, key) => {
                  return previous + this.state.files[key].size;
                }, 0);

    let completed = keys.reduce((previous, key) => {
                      return previous + this.state.files[key].written;
                    }, 0);

    let raw = (completed / total);

    let percent = (raw * 100).toFixed(2);

    let secsElapsed = (new Date() - this.state.startTime) / 1000;

    let speed = completed / secsElapsed;

    this.uiButton.setProgress(raw.toFixed(4));
    this.percent.innerHTML = `${percent}%`;

    let text = humanize.filesize(completed);
    text += ' de ';
    text += humanize.filesize(total);
    text += ' - ';
    text += humanize.filesize(speed) + '/s';
    text += ' - ( '
    text += secsElapsed.toFixed(2);
    text += ' secs )';

    this.progressInfo.innerHTML = text;
  },

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

  getName(path) {
    return path.split('/').slice(-1)[0];
  }
};

App.init();
