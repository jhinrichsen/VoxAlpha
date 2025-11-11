package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

func main() {
	// Get current working directory and find project root
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}

	// If running from tools/screenshot, go up two levels
	// Otherwise assume we're in project root
	projectRoot := cwd
	if filepath.Base(cwd) == "screenshot" {
		projectRoot = filepath.Join(cwd, "..", "..")
	}
	projectRoot, _ = filepath.Abs(projectRoot)
	screenshotsDir := filepath.Join(projectRoot, "screenshots")

	// Ensure screenshots directory exists
	if err := os.MkdirAll(screenshotsDir, 0755); err != nil {
		log.Fatalf("Failed to create screenshots directory: %v", err)
	}

	// Start a local server or use the URL where the app is running
	// For this example, assuming the app is running at http://localhost:8080
	url := os.Getenv("APP_URL")
	if url == "" {
		url = "http://localhost:8080"
	}

	fmt.Printf("Taking screenshots of %s\n", url)

	// Create Chrome context with logging disabled to suppress IPAddressSpace warnings
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
	)
	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	// Set timeout
	ctx, cancel = context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	// Take wide screenshot (1280x720)
	fmt.Println("Capturing wide screenshot...")

	// Set up a listener for JavaScript dialogs (confirm/alert)
	chromedp.ListenTarget(ctx, func(ev interface{}) {
		if _, ok := ev.(*page.EventJavascriptDialogOpening); ok {
			fmt.Println("Dialog detected, dismissing...")
			go chromedp.Run(ctx, page.HandleJavaScriptDialog(false))
		}
	})

	var wideScreenshot []byte
	if err := chromedp.Run(ctx,
		chromedp.EmulateViewport(1280, 720),
		chromedp.Navigate(url),
		chromedp.Sleep(3*time.Second), // Wait for app and potential dialog
		chromedp.CaptureScreenshot(&wideScreenshot),
	); err != nil {
		log.Fatalf("Failed to take wide screenshot: %v", err)
	}

	wideFile := filepath.Join(screenshotsDir, "screenshot-wide.png")
	if err := os.WriteFile(wideFile, wideScreenshot, 0644); err != nil {
		log.Fatalf("Failed to save wide screenshot: %v", err)
	}
	fmt.Printf("✓ Saved wide screenshot: %s\n", wideFile)

	// Take narrow screenshot (540x720)
	fmt.Println("Capturing narrow screenshot...")

	var narrowScreenshot []byte
	if err := chromedp.Run(ctx,
		chromedp.EmulateViewport(540, 720),
		chromedp.Navigate(url),
		chromedp.Sleep(3*time.Second), // Wait for app and potential dialog
		chromedp.CaptureScreenshot(&narrowScreenshot),
	); err != nil {
		log.Fatalf("Failed to take narrow screenshot: %v", err)
	}

	narrowFile := filepath.Join(screenshotsDir, "screenshot-narrow.png")
	if err := os.WriteFile(narrowFile, narrowScreenshot, 0644); err != nil {
		log.Fatalf("Failed to save narrow screenshot: %v", err)
	}
	fmt.Printf("✓ Saved narrow screenshot: %s\n", narrowFile)

	fmt.Println("\nScreenshots captured successfully!")
}
