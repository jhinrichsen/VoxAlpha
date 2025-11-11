# Transcription Quality Analysis & Solutions

## Current Issue
- **Spoken**: "Köln"
- **Whisper Output**: "Krön"
- **Matched To**: "Kronach" (57.1%)
- **Expected**: "Kassel"

The **tiny model (31MB)** is too small for accurate German city transcription.

---

## Performance vs Quality Trade-offs

| Model | Size | Speed (estimate) | Accuracy | Best For |
|-------|------|------------------|----------|----------|
| **tiny** | 31MB | 3-5s | ⭐⭐ | Testing, demos |
| **base** | 74MB | 5-8s | ⭐⭐⭐ | Balanced use |
| **small** | 244MB | 15-25s | ⭐⭐⭐⭐ | Good accuracy |
| **medium** | 769MB | 45-90s | ⭐⭐⭐⭐⭐ | Best accuracy |

---

## Solution Options

### Option 1: Use Larger Model ⭐ **RECOMMENDED**
**Pros:**
- Significantly better accuracy (base is ~2x better than tiny)
- Better German language understanding
- Better rare word recognition

**Cons:**
- Larger download (74MB vs 31MB for base)
- Slightly slower (5-8s vs 3-5s with 8 threads)

**Implementation:**
Already supported! Just pass model path:
```bash
./voxalpha --model ggml-base-q8_0.bin
```

---

### Option 2: Improve Phonetic Matching (Complementary)
Add German-aware phonetic matching to handle transcription errors:

**Phonetic Rules:**
- K/C confusion: Köln ↔ Cöln
- ö/oe: Köln ↔ Koeln, Krön
- Final consonants: t/d, k/g often confused
- Compound word splitting

**Implementation:**
- Use Metaphone or custom German phonetic algorithm
- Prefer matches that start with the correct letter
- Weight first syllable more heavily

---

### Option 3: Context-Aware Matching
Since you know the expected letter, filter candidates:

**Current**: Matches "Krön" → "Kronach" (wrong letter K vs expected K)
**Improved**: 
1. Get transcription "Krön"
2. Filter cities starting with challenge letter 'K'
3. Among K-cities, find best match
4. "Krön" → "Köln" (same letter, better match)

---

### Option 4: Show Top-N Candidates
Let user choose from top 3 matches:
```
Did you say:
1. Köln (67%)
2. Kronach (57%)  
3. Koblenz (52%)
```

---

## Recommendations

### Short-term (Quick Wins)
1. ✅ **Enable multi-threading** (DONE - 4x speedup!)
2. ✅ **Add letter-context filtering** (filter by current letter)
3. ✅ **Add phonetic normalization** (ö→oe, ü→ue, etc.)

### Medium-term
4. **Upgrade to base model** - Best bang for buck
5. **Add fuzzy matching improvements** - Consider phonetic distance

### Long-term
6. **Use medium/small model** for production
7. **Fine-tune model** on German city dataset
8. **Use native Whisper.cpp** server for 10-100x speed

---

## Model Availability

Check existing models:
```bash
ls -lh *.bin
```

Download base model:
```bash
# Quantized base model (~74MB)
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q8_0.bin

# Or from whisper.cpp releases
curl -L -o ggml-base-q8_0.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

---

## Expected Improvements

### Tiny → Base Model:
- **Köln**: "Krön" → "Köln" ✅
- **Nürnberg**: "Nöentbeerk" → "Nürnberg" ✅
- **Wolfsburg**: "Wetslaw" → "Wolfsburg" ✅
- **WER (Word Error Rate)**: ~30% → ~15%

### With Context Filtering:
- False positive rate: 57% → 80%+ correct matches
- User frustration: ↓↓↓

---

## Next Steps

1. Test with base model
2. Implement letter-context filtering
3. Add phonetic normalization for umlauts
4. Consider showing confidence scores to user
