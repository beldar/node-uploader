const knox = require('knox');
const fs = require('fs');
const dir = require('node-dir');

const App = {
  init() {
    this.dropzone = document.getElementById('dropzone');
    this.getname = document.getElementById('getname');
    this.wrapper = document.getElementById('wrapper');

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
      , bucket: 'boda-marti-anna'
    });
  },

  show() {
    if (this.username) {
      this.getname.classList.remove('show');
      this.dropzone.classList.add('show');
      this.wrapper.classList.add('dropzone');
      this.setDropzone();
    } else {
      this.dropzone.classList.remove('show');
      this.getname.classList.add('show');
      this.wrapper.classList.remove('dropzone');
      this.setGetname();
    }
  },

  setGetname() {
    this.button = document.getElementById('save');
    this.input = document.getElementById('username');

    this.button.addEventListener('click', () => {
      if (this.input.value !== '') {
        localStorage.setItem('username', this.input.value);
        this.username = this.input.value;
        this.show();
      }
    });
  },

  setDropzone() {
    this.state = {
      totalFiles: 0,
      completedFiles: 0,
      totalSize: 0,
      completedSize: 0,
      timeElapsed: 0
    };

    this.progressBar = document.getElementById('progress');

    this.wrapper.addEventListener('dragenter', () => this.wrapper.classList.add('enter'));
    this.wrapper.addEventListener('dragleave', () => this.wrapper.classList.remove('enter'));
    this.wrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.wrapper.classList.remove('enter');
      return false;
    });

    this.wrapper.addEventListener('drop', (e) => {
      e.preventDefault();

      let files = e.target.files || e.dataTransfer.files;

      this.files = files;

      this.uploadFiles();

      return false;

    });
  },

  uploadFiles() {
    let files = this.files;

    for (var i = 0; i < files.length; i++) {
        file = files[i];
        this.state.totalFiles++;
        this.state.totalSize += file.size;

        this.uploadFile(file);
        console.log(file);
    }
  },

  uploadFile(file) {
    if (! this.username) return;

    if (fs.lstatSync(file.path).isDirectory()) {
      this.uploadDir(file);
      return;
    }

    let path = this.username.trim().replace(' ', '-') + '/' + file.name.trim().replace(' ', '-');

    console.log('Upload to: ' + path);

    let req = this.client.putFile(file.path, path, this.fileDone);

    req.on('progress', this.updateProgress);
    req.on('response', this.fileCompleted);
    req.on('error', this.fileFailed)
  },

  uploadDir(file) {
    dir.files(file.path, (err, files) => {
        if (err) throw err;
        console.log(files);

        files.forEach((path) => {
          let stat = fs.lstatSync(path);
          let name = this.getName(path);

          this.state.totalFiles++;
          this.state.totalSize += stat.size;

          let file = {
            name: name,
            path: path
          };

          this.uploadFile(file);
        });
    });
  },

  updateProgress(e) {
    console.log('Progress', e);
    App.state.completedSize += e.written;

    let percent = ((App.state.completedSize / App.state.totalSize) * 100).toFixed(2);

    App.progressBar.style.width = percent + '%';
  },

  fileCompleted(e) {
    console.log('File completed', e);
  },

  fileDone(err, res) {
    console.log('File done', err, res);
  },

  fileFailed(e) {
    console.error('File failed', e);
  },

  getName(path) {
    return path.split('/').slice(-1)[0];
  }
};

App.init();
