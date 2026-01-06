package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
)

// Version is set via ldflags during build
var version = "dev"

//go:embed dist/pwa
var content embed.FS

//go:embed dist/ggml-small-q8_0.bin
var modelData []byte

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
	model := flag.String("model", "", "Path to external Whisper model file (overrides embedded model)")
	flag.Parse()

	if showVersion {
		fmt.Println(version)
		return
	}

	// Create filesystem with proper MIME types
	distFS, err := fs.Sub(content, "dist/pwa")
	if err != nil {
		log.Fatal(err)
	}
	fsys := http.FS(distFS)

	// Serve Whisper model (embedded or external override)
	http.HandleFunc("/ggml-small-q8_0.bin", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
		w.Header().Set("Content-Type", "application/octet-stream")

		if *model != "" {
			// Serve external model if specified
			http.ServeFile(w, r, *model)
		} else {
			// Serve embedded model
			w.Header().Set("Content-Length", fmt.Sprintf("%d", len(modelData)))
			w.Write(modelData)
		}
	})

	// Serve config endpoint
	http.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")

		config := map[string]interface{}{
			"modelUrl": "/ggml-small-q8_0.bin",
		}
		if *model != "" {
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
