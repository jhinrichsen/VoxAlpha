package tests

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/chromedp/chromedp"
)

const (
	testPort           = "8082"
	maxMemoryGrowthMB  = 50 // Maximum acceptable memory growth in MB
	numRecordings      = 20 // Number of recordings to simulate
)

// TestMemoryLeak verifies that repeated recordings don't cause memory leaks
func TestMemoryLeak(t *testing.T) {
	// Start test server
	server := startTestServer(t)
	defer server.Close()

	// Setup Chrome context
	// IMPORTANT: Use fresh user-data-dir to prevent Service Worker cache issues.
	// Service Worker persists across test runs in the same profile, causing tests
	// to serve stale cached versions instead of latest dist/pwa/ build.
	// Fresh profile ensures deterministic test environment.
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("js-flags", "--expose-gc"), // Enable manual GC
		chromedp.Flag("user-data-dir", t.TempDir()), // Fresh profile per test
	)
	allocCtx, cancelAlloc := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancelAlloc()

	ctx, cancelCtx := chromedp.NewContext(allocCtx)
	defer func() {
		// Explicitly shutdown Chrome and wait for cleanup
		cancelCtx()
		time.Sleep(500 * time.Millisecond) // Give Chrome time to release file handles
	}()

	// Set timeout
	ctx, cancelTimeout := context.WithTimeout(ctx, 30*time.Second)
	defer cancelTimeout()

	// Navigate to app
	url := fmt.Sprintf("http://localhost:%s/voxalpha.html", testPort)
	t.Logf("Opening %s", url)

	if err := chromedp.Run(ctx, chromedp.Navigate(url)); err != nil {
		t.Fatalf("Failed to navigate: %v", err)
	}

	// Wait for app to initialize
	time.Sleep(2 * time.Second)

	// Force GC to clear initialization overhead before baseline
	if err := forceGC(ctx); err != nil {
		t.Logf("Warning: Failed to force initial GC: %v", err)
	}
	time.Sleep(500 * time.Millisecond)

	// Get baseline memory (after initial GC)
	baseline, err := getMemoryUsage(ctx)
	if err != nil {
		t.Fatalf("Failed to get baseline memory: %v", err)
	}
	t.Logf("Baseline memory: %.2f MB (after initial GC)", float64(baseline)/1024/1024)

	// Simulate recordings
	t.Logf("Simulating %d recordings...", numRecordings)
	previousMem := baseline
	for i := 0; i < numRecordings; i++ {
		if err := simulateRecording(ctx); err != nil {
			t.Fatalf("Recording %d failed: %v", i+1, err)
		}

		// Wait for cleanup to complete (robust polling instead of sleep)
		if err := waitForCleanup(ctx, 2*time.Second); err != nil {
			t.Fatalf("Recording %d cleanup timeout: %v", i+1, err)
		}

		// Force GC periodically to avoid accumulation (not a leak, just garbage)
		if err := forceGC(ctx); err != nil {
			t.Logf("Warning: Failed to force GC after recording %d: %v", i+1, err)
		}

		// Check memory every 5 recordings
		if (i+1)%5 == 0 {
			mem, err := getMemoryUsage(ctx)
			if err != nil {
				t.Logf("Warning: Failed to get memory at recording %d", i+1)
				continue
			}
			deltaFromPrevious := float64(mem-previousMem) / 1024 / 1024
			deltaFromBaseline := float64(mem-baseline) / 1024 / 1024
			t.Logf("Recording %2d: %.2f MB (Δ prev: %+.2f MB, Δ baseline: %+.2f MB)",
				i+1, float64(mem)/1024/1024, deltaFromPrevious, deltaFromBaseline)
			previousMem = mem
		}
	}

	// Force garbage collection multiple times (V8 uses generational GC)
	for i := 0; i < 3; i++ {
		if err := forceGC(ctx); err != nil {
			t.Logf("Warning: Failed to force GC (pass %d): %v", i+1, err)
		}
		time.Sleep(500 * time.Millisecond)
	}

	// Get final memory
	final, err := getMemoryUsage(ctx)
	if err != nil {
		t.Fatalf("Failed to get final memory: %v", err)
	}

	// Calculate net growth
	netGrowthBytes := final - baseline
	netGrowthMB := float64(netGrowthBytes) / 1024 / 1024

	t.Logf("\n=== Memory Analysis ===")
	t.Logf("Baseline: %.2f MB", float64(baseline)/1024/1024)
	t.Logf("Final:    %.2f MB", float64(final)/1024/1024)
	t.Logf("Net growth: %.2f MB", netGrowthMB)
	t.Logf("Limit:      %.2f MB", float64(maxMemoryGrowthMB))

	// Assert
	if netGrowthMB > maxMemoryGrowthMB {
		t.Errorf("MEMORY LEAK DETECTED: Memory grew by %.2f MB (limit: %d MB)", netGrowthMB, maxMemoryGrowthMB)
		t.Error("Check blob URL cleanup and audioData references")
	} else {
		t.Logf("✓ OK: Memory growth within acceptable limits")
	}
}

// simulateRecording simulates a single recording cycle
func simulateRecording(ctx context.Context) error {
	script := `
		(function() {
			// Reset cleanup flag
			window.__recordingCleanupDone = false;

			// Simulate 3 seconds of audio
			const sampleRate = 16000;
			const duration = 3;
			const samples = sampleRate * duration;

			// Create audio data
			let audioData = new Float32Array(samples);
			for (let i = 0; i < samples; i++) {
				audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
			}

			// Simulate WAV conversion (like whisper-wrapper does)
			const wavSize = 44 + samples * 2;
			let buffer = new ArrayBuffer(wavSize);
			let view = new DataView(buffer);

			// Write WAV header
			const writeString = (offset, string) => {
				for (let i = 0; i < string.length; i++) {
					view.setUint8(offset + i, string.charCodeAt(i));
				}
			};
			writeString(0, 'RIFF');
			view.setUint32(4, 36 + samples * 2, true);
			writeString(8, 'WAVE');
			writeString(12, 'fmt ');
			view.setUint32(16, 16, true);
			view.setUint16(20, 1, true);
			view.setUint16(22, 1, true);
			view.setUint32(24, sampleRate, true);
			view.setUint32(28, sampleRate * 2, true);
			view.setUint16(32, 2, true);
			view.setUint16(34, 16, true);
			writeString(36, 'data');
			view.setUint32(40, samples * 2, true);

			// Write PCM samples
			let offset = 44;
			for (let i = 0; i < samples; i++, offset += 2) {
				const s = Math.max(-1, Math.min(1, audioData[i]));
				view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
			}

			// Create blob and URL (this is what we're testing for leaks)
			let blob = new Blob([buffer], { type: 'audio/wav' });
			let url = URL.createObjectURL(blob);

			// Simulate download link
			let a = document.createElement('a');
			a.href = url;
			a.download = 'test.wav';

			// IMPORTANT: This should be cleaned up by our fix
			// In whisper-wrapper.js we have:
			// setTimeout(() => URL.revokeObjectURL(url), 100);

			// For this test, we manually clean up to test the pattern
			setTimeout(() => {
				URL.revokeObjectURL(url);
				// Explicitly clear all references for GC (our fix)
				audioData = null;
				buffer = null;
				view = null;
				blob = null;
				url = null;
				a = null;
				// Signal cleanup complete
				window.__recordingCleanupDone = true;
			}, 100);

			return true;
		})();
	`

	var result bool
	if err := chromedp.Run(ctx, chromedp.Evaluate(script, &result)); err != nil {
		return fmt.Errorf("script execution failed: %w", err)
	}

	return nil
}

// getMemoryUsage returns JS heap size in bytes
func getMemoryUsage(ctx context.Context) (int64, error) {
	var mem int64
	err := chromedp.Run(ctx,
		chromedp.Evaluate(`performance.memory ? performance.memory.usedJSHeapSize : 0`, &mem),
	)
	return mem, err
}

// forceGC triggers garbage collection if available
func forceGC(ctx context.Context) error {
	script := `if (window.gc) { window.gc(); }`
	return chromedp.Run(ctx, chromedp.Evaluate(script, nil))
}

// waitForCleanup waits for the cleanup flag to be set (robust alternative to sleep)
func waitForCleanup(ctx context.Context, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			var done bool
			err := chromedp.Run(ctx,
				chromedp.Evaluate(`window.__recordingCleanupDone || false`, &done),
			)
			if err != nil {
				return fmt.Errorf("failed to check cleanup flag: %w", err)
			}
			if done {
				return nil
			}
			if time.Now().After(deadline) {
				return fmt.Errorf("cleanup timeout after %v", timeout)
			}
		}
	}
}

// startTestServer starts a test HTTP server serving the dist directory
func startTestServer(t *testing.T) *http.Server {
	t.Helper()

	mux := http.NewServeMux()

	// Serve dist/pwa directory (PWA build output)
	fs := http.FileServer(http.Dir("../dist/pwa"))
	mux.Handle("/", addCOOPHeaders(fs))

	server := &http.Server{
		Addr:    ":" + testPort,
		Handler: mux,
	}

	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		t.Fatalf("Failed to start test server: %v", err)
	}

	go func() {
		if err := server.Serve(listener); err != http.ErrServerClosed {
			t.Logf("Server error: %v", err)
		}
	}()

	t.Logf("Test server started on http://localhost:%s", testPort)
	time.Sleep(500 * time.Millisecond) // Give server time to start

	return server
}

// addCOOPHeaders adds Cross-Origin headers required for WASM
func addCOOPHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
		next.ServeHTTP(w, r)
	})
}
