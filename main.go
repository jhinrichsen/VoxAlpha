package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
)

// Version is set via ldflags during build
var version = "dev"

//go:embed index.html style.css script.js storage.js service-worker.js clear-cache.html manifest.json favicon.svg german-cities.txt whisper-wrapper.js tts-wrapper.js
//go:embed lib data icons screenshots
var content embed.FS

func main() {
	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "VoxAlpha %s - Offline Speech Spelling Trainer\n\nUsage:\n", version)
		flag.PrintDefaults()
	}
	var showVersion bool
	flag.BoolVar(&showVersion, "version", false, "Show version and exit")
	server := flag.String("server", "localhost", "HTTP server host")
	port := flag.String("port", "8081", "HTTP server port")
	browse := flag.Bool("browse", true, "Open browser window automatically")
	model := flag.String("model", "", "Path to external Whisper model file (default: embedded tiny model)")
	flag.Parse()

	if showVersion {
		fmt.Println(version)
		return
	}

	// Create filesystem with proper MIME types
	fsys := http.FS(content)

	// Serve external model if provided
	if *model != "" {
		http.HandleFunc("/external-model.bin", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
			w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
			http.ServeFile(w, r, *model)
		})
	}

	// Serve config endpoint
	http.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")

		config := map[string]interface{}{}
		if *model != "" {
			config["modelUrl"] = "/external-model.bin"
			config["modelPath"] = *model
		}

		json.NewEncoder(w).Encode(config)
	})

	// Custom handler to set required headers for WASM
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		// Set COOP/COEP headers for SharedArrayBuffer support (required by Whisper WASM)
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")

		// Set proper content types
		for ext, contentType := range map[string]string{
			".css":  "text/css",
			".js":   "application/javascript",
			".json": "application/json",
			".wasm": "application/wasm",
		} {
			if strings.HasSuffix(path, ext) {
				w.Header().Set("Content-Type", contentType)
				break
			}
		}

		// Serve file
		http.FileServer(fsys).ServeHTTP(w, r)
	})
	http.Handle("/", handler)

	url := fmt.Sprintf("http://%s:%s", *server, *port)

	listener, err := net.Listen("tcp", fmt.Sprintf("%s:%s", *server, *port))
	if err == nil {
		log.Printf("Started VoxAlpha %s on %s", version, url)
	} else {
		log.Fatal(err)
	}

	if *browse {
		log.Printf("Opening %s", url)
		if err := openBrowser(url); err != nil {
			log.Printf("Failed to open browser, please open %s manually", url)
		}
	}

	if err := http.Serve(listener, nil); err != nil {
		log.Fatal(err)
	}
}

func openBrowser(url string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "linux":
		cmd = "xdg-open"
	case "darwin":
		cmd = "open"
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start"}
	default:
		return fmt.Errorf("unsupported platform")
	}

	args = append(args, url)
	return exec.Command(cmd, args...).Start()
}
