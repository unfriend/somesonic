# SomeSonic

A modern, beautiful Subsonic music player client built with vanilla JavaScript.

![SomeSonic Screenshot](https://github.com/user-attachments/assets/cd5bcb4e-2ef6-4e15-bfba-fd74dbc1671b)

## Features

- **Subsonic API Integration**: Full support for Subsonic/OpenSubsonic/Navidrome/Airsonic servers
- **Dark Theme UI**: Modern foobar2000-inspired interface
- **Audio Visualizations**: Real-time waveform and spectrogram displays
- **Library Browser**: Browse by artist/album with expandable tree view
- **Playlist View**: Album-grouped playlist with cover art
- **Keyboard Shortcuts**: Space (play/pause), arrows (seek/volume), Ctrl+arrows (next/prev)
- **Audio Analysis**: Web Audio API integration for visualizations

## Getting Started

### Prerequisites

- A Subsonic-compatible server (Subsonic, Navidrome, Airsonic, etc.)
- Modern web browser with ES6 module support

### Running Locally

1. Clone the repository:
```bash
git clone https://github.com/unfriend/somesonic.git
cd somesonic
```

2. Start a local server:
```bash
npm start
# or use any static file server
npx serve .
```

3. Open your browser to the local server URL

4. Click "File" to configure your Subsonic server connection

### Configuration

Enter your Subsonic server details in the Settings modal:
- **Server URL**: Your Subsonic server URL (e.g., `https://your-server.com`)
- **Username**: Your Subsonic username
- **Password**: Your Subsonic password

Click "Test Connection" to verify the connection before saving.

## Architecture

```
src/
├── index.js       # Main application entry point
├── subsonic.js    # Subsonic API client
├── player.js      # Audio player with queue management
├── visualizer.js  # Waveform and spectrogram visualizations
└── styles/
    └── main.css   # Application styles
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← / → | Seek -5s / +5s |
| Ctrl + ← / → | Previous / Next track |
| ↑ / ↓ | Volume up / down |

## API Compatibility

SomeSonic implements the Subsonic REST API v1.16.1 and is compatible with:
- [Subsonic](http://www.subsonic.org/)
- [Navidrome](https://www.navidrome.org/)
- [Airsonic](https://airsonic.github.io/)
- [Airsonic-Advanced](https://github.com/airsonic-advanced/airsonic-advanced)
- Other OpenSubsonic-compatible servers

## License

ISC
