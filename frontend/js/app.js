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

    this.show();
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
    this.wrapper.addEventListener('dragenter', () => this.wrapper.classList.add('enter'));
    this.wrapper.addEventListener('dragleave', () => this.wrapper.classList.remove('enter'));
    this.wrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.wrapper.classList.remove('enter');
      return false;
    });
    
    this.wrapper.addEventListener('drop', (e) => {
      e.preventDefault();

      // fetch FileList object
      var files = e.target.files || e.dataTransfer.files;

      console.log(files);

      return false;

    });
  }
};

App.init();
