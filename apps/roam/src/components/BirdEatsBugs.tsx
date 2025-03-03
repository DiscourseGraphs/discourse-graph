type FeedbackWidget = {
  initialize?: boolean;
  invoked?: boolean;
  methods?: string[];
  factory?: (method: string) => (...args: any[]) => FeedbackWidget;
  load?: () => void;
  push?: (args: any[]) => void;
  setOptions?: (options: { 
    publicAppId: string;
    ui?: {
      position?: string;
      defaultButton?: {
        icon?: string;
      };
      text?: {
        defaultButton?: string;
      };
      watermark?: boolean;
    };
  }) => void;
  [key: string]: any;
  length?: number;
}

declare global {
  interface Window {
    birdeatsbug?: FeedbackWidget | any[];
  }
}

export const initFeedbackWidget = (): void => {
  const birdeatsbug = (window.birdeatsbug = window.birdeatsbug || []) as FeedbackWidget;
  
  if (birdeatsbug.initialize) return;
  
  if (birdeatsbug.invoked) {
    if (window.console && console.error) {
      console.error('birdeatsbug snippet included twice.');
    }
    return;
  }
  
  birdeatsbug.invoked = true;
  
  birdeatsbug.methods = [
    'setOptions',
    'trigger',
    'resumeSession',
    'takeScreenshot',
    'startRecording',
    'stopRecording',
    'stopSession',
    'uploadSession',
    'deleteSession',
  ];
  
  birdeatsbug.factory = (method) => {
    return function() {
      const args = Array.prototype.slice.call(arguments);
      args.unshift(method);
      birdeatsbug.push?.(args);
      return birdeatsbug;
    };
  };
  
  for (let i = 0; i < birdeatsbug.methods.length; i++) {
    const key = birdeatsbug.methods[i];
    birdeatsbug[key] = birdeatsbug.factory(key);
  }
  
  birdeatsbug.load = () => {
    // Create an async script element
    const script = document.createElement('script');
    script.type = 'module';
    script.async = true;
    script.src = 'https://sdk.birdeatsbug.com/v3/core.js';
    
    const mountJsBefore = document.getElementsByTagName('script')[0] || document.body.firstChild;
    mountJsBefore.parentNode?.insertBefore(script, mountJsBefore);

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.type = 'text/css';
    style.href = 'https://sdk.birdeatsbug.com/v3/style.css';
    
    const mountCssBefore = document.querySelector('link[rel="stylesheet"]') || mountJsBefore;
    mountCssBefore.parentNode?.insertBefore(style, mountCssBefore);
  };

  birdeatsbug.load();
  
  const customStyles = document.createElement('style');
  customStyles.textContent = `
   
    /* Target the specific Bird Eats Bug container */
    #birdeatsbug-sdk {
      --distance-to-window-edge-vertical: 50px;
      --distance-to-window-edge-horizontal: 20px;
    }
    
    /* Override specific elements */
    #birdeatsbug-sdk .form-error {
      font-size: 1.2rem;
    }
    
    /* Change colors for dark theme */
    #birdeatsbug-sdk.dark {
      --button-primary-bg-color: #1976d2;
    }
  `;
  document.head.appendChild(customStyles);
  
  if (window.birdeatsbug && 'setOptions' in window.birdeatsbug) {
    window.birdeatsbug.setOptions!(
        { publicAppId: 'faf02e48-84b7-4292-b76c-03d9342ba9aa',
          ui: {position: 'bottom-right',
               defaultButton : {icon: 'exclamation'},
               text: {defaultButton: 'Send Feedback'},
               watermark: false
          }
    });
  }
};

