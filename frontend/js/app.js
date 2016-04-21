const knox = require('knox');
const fs = require('fs');
const dir = require('node-dir');

const App = {
  init() {
    this.dropzone = document.getElementById('dropzone');
    this.getname = document.getElementById('getname');
    this.wrapper = document.getElementById('wrapper');
    this.progressBar = document.getElementById('progress');

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

  resetState() {
    this.state = {
      files: {},
      timeElapsed: 0
    };

    this.progressBar.style.width = 0;
  },

  setDropzone() {
    this.wrapper.addEventListener('dragenter', () => this.wrapper.classList.add('enter'));
    this.wrapper.addEventListener('dragover', (e) => e.preventDefault());
    this.wrapper.addEventListener('drop', (e) => {
      e.preventDefault();

      this.wrapper.classList.remove('enter');

      let files = e.target.files || e.dataTransfer.files;

      console.log('Drop', files);

      this.resetState();

      this.uploadFiles(files);

      return false;
    });
  },

  uploadFiles(files) {
    for (var i = 0; i < files.length; i++) {
      let file = files[i];
      this.uploadFile(file.name, file.size, file.path);
    }
  },

  uploadFile(name, size, path) {
    let file = {
      name     : name,
      size     : size,
      path     : path,
      written  : 0,
      completed: false,
      failed   : false
    };

    if (! this.username) return;

    if (file.name.indexOf('.DS_Store') !== -1 || file.name.indexOf('Thumbs.db') !== -1) return;

    console.log(file);
    if (fs.lstatSync(file.path).isDirectory()) {
      this.uploadDir(file);
      return;
    }

    this.state.files[file.name] = file;

    let awsPath = this.username.trim().replace(' ', '-') + '/' + file.name.trim().replace(' ', '-');
    let req = this.client.putFile(file.path, awsPath, (err, res) => {
      if (err) {
        file.failed = true;
        console.log(this.state.files);
        return;
      }

      file.completed = true;

      console.log(this.state.files);
    });

    req.on('progress', (e) => {
      file.written = e.written;
      this.updateProgress();
    });
  },

  uploadDir(file) {
    console.log('uploadDir', file);

    dir.files(file.path, (err, files) => {
        if (err) throw err;
        console.log(files);

        files.forEach((path) => {
          let stat = fs.lstatSync(path);
          let name = this.getName(path);

          this.uploadFile(name, stat.size, path);
        });
    });
  },

  updateProgress() {
    console.log(this.state.files);

    let keys = Object.keys(this.state.files);

    let total = keys.reduce((previous, key) => {
                  return previous + this.state.files[key].size;
                }, 0);

    let completed = keys.reduce((previous, key) => {
                      return previous + this.state.files[key].written;
                    }, 0);

    let percent = ((completed / total) * 100).toFixed(2);

    console.log('Progress', percent, this.state);

    this.progressBar.style.width = percent + '%';
  },

  fileDone(err, res) {
    console.log('File done', err, res);

    if (err) {
      this.state.filesFailed.push(err);
      return;
    }

    this.state.filesUploaded.push(res.req.path);
  },

  getName(path) {
    return path.split('/').slice(-1)[0];
  }
};

App.init();
