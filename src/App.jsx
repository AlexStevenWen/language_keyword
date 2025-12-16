import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Volume2, Keyboard, Mic, Upload, X, Loader2, WifiOff, Download, BookOpen, ScanText, CheckCircle2, ArrowRightLeft, Eye, EyeOff, MessageSquare, MessageSquareOff, Globe2, Ear, Volume1, MousePointer2 } from 'lucide-react';

const App = () => {
  // --- 狀態管理 ---
  const [inputText, setInputText] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [wordTranslation, setWordTranslation] = useState('');
  const [currentWord, setCurrentWord] = useState('');
  const [accuracy, setAccuracy] = useState(100);
  
  // UI 狀態
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0, height: 0 }); 
  const [refTooltipPos, setRefTooltipPos] = useState({ top: 0, left: 0, visible: false, word: '', translation: '', phonetic: '' }); 
  
  const [showFloatingTooltip, setShowFloatingTooltip] = useState(true); 
  const [isInputTooltipVisible, setIsInputTooltipVisible] = useState(false); 
  const [showReference, setShowReference] = useState(true);
  
  // 新增：懸停翻譯開關 (Hover Translate Toggle)
  const [hoverRefEnabled, setHoverRefEnabled] = useState(true);

  // 單字打完自動發音開關
  const [autoSpeakWord, setAutoSpeakWord] = useState(true); 

  const [sourceLang, setSourceLang] = useState('en-US');
  const [targetLang, setTargetLang] = useState('zh-TW');
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWordLoading, setIsWordLoading] = useState(false);
  const [usingOfflineMode, setUsingOfflineMode] = useState(false);
  
  const [practiceMode, setPracticeMode] = useState(true); 
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(false); 
  const [voices, setVoices] = useState([]);

  // --- Refs ---
  const inputRef = useRef(null);
  const referenceContainerRef = useRef(null);
  const referenceScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const sourceLangRef = useRef(null);
  const targetLangRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const wordDebounceTimerRef = useRef(null);
  const mirrorRef = useRef(null);
  
  const isComposingRef = useRef(false); 
  const lastSpokenIndexRef = useRef(-1); 

  // --- 初始化 ---
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    setReferenceText(
`Accessibility is essential. こうした問題は解決できます。
今天天氣很好，適合寫程式。
안녕하세요.
Namaste duniya.
Bonjour le monde.
`
    );
  }, []);

  // --- 輔助：判斷是否為 CJK 字符 ---
  const isCJK = (text) => /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(text);

  // --- 模擬音標字典 ---
  const getMockPhonetic = (text) => {
    const cleanText = text.replace(/[.,!?;:，。！？]/g, '');
    const demoDict = {
      '今天': 'Jīntiān', '天氣': 'Tiānqì', '很好': 'Hěn hǎo', 
      '適合': 'Shìhé', '寫程式': 'Xiě chéngshì', '寫': 'Xiě', '程式': 'Chéngshì',
      '真好': 'Zhēn hǎo',
      'こうした': 'Kōshita', '問題': 'Mondai', 'は': 'Wa', 
      '解決': 'Kaiketsu', 'できます': 'Dekimasu', 'でき': 'Deki', 'ます': 'Masu',
      'こんにちは': 'Konnichiwa', '世界': 'Sekai',
      '안녕하세요': 'Annyeonghaseyo', '사랑해요': 'Saranghaeyo',
      'Accessibility': '/əkˌses.əˈbɪl.ə.t̬i/', 'Essential': '/ɪˈsen.ʃəl/',
      'Hello': '/həˈloʊ/', 'World': '/wɝːld/',
      'Namaste': 'Namaste', 'duniya': 'Duniya', 'नमस्ते': 'Namaste', 'दुनिया': 'Duniya',
      'Guten': 'ɡuːtən', 'Tag': 'taːk',
      'Bonjour': '/bɔ̃.ʒuʁ/', 'le': '/lə/', 'monde': '/mɔ̃d/'
    };
    return demoDict[cleanText] || null;
  };

  // --- 發音功能 ---
  const handleSpeak = useCallback((text, lang) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang || sourceLang;
    const bestVoice = voices.find(v => v.lang === utterance.lang) || voices.find(v => v.lang.startsWith(utterance.lang.split('-')[0]));
    if (bestVoice) utterance.voice = bestVoice;
    window.speechSynthesis.speak(utterance);
  }, [sourceLang, voices]);

  // --- 核心演算法：將範文結構化 (Tokenize) ---
  const referenceTokens = useMemo(() => {
    if (!referenceText) return [];
    
    let tokens = [];
    const segmentLang = sourceLang; 

    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
         try {
            const segmenter = new Intl.Segmenter(segmentLang, { granularity: 'word' });
            tokens = Array.from(segmenter.segment(referenceText)).map(item => item.segment);
         } catch (e) {
            tokens = referenceText.split(/([\s,.!?;:，。！？、：；「」『』()（）\n]+)/);
         }
    } else {
         tokens = referenceText.split(/([\s,.!?;:，。！？、：；「」『』()（）\n]+)/);
    }

    let globalIndex = 0;
    return tokens.map(token => {
        const isWord = /[^\s\p{P}]/u.test(token);
        const start = globalIndex;
        const end = globalIndex + token.length;
        globalIndex += token.length;
        
        return {
            text: token,
            isWord,
            start,
            end,
            isCJK: isCJK(token)
        };
    });
  }, [referenceText, sourceLang]);

  // --- 檢查並發音的邏輯 ---
  const checkInputMatch = (currentText) => {
      if (!autoSpeakWord || !practiceMode) return;

      const currentLen = currentText.length;
      if (currentLen < lastSpokenIndexRef.current) {
          lastSpokenIndexRef.current = -1;
          return;
      }

      const completedToken = referenceTokens.find(t => t.end === currentLen && t.isWord);

      if (completedToken) {
          if (lastSpokenIndexRef.current === currentLen) return;
          const typedWord = currentText.substring(completedToken.start, completedToken.end);
          if (typedWord === completedToken.text) {
              handleSpeak(completedToken.text, sourceLang);
              lastSpokenIndexRef.current = currentLen;
          }
      }
  };

  // --- IME 處理 ---
  const handleCompositionStart = () => { 
      isComposingRef.current = true; 
      setIsInputTooltipVisible(false);
  };
  
  const handleCompositionEnd = (e) => { 
      isComposingRef.current = false; 
      setTimeout(() => {
          handleCursorActivity(); 
          checkInputMatch(e.target.value);
      }, 0);
  };

  // --- 監控輸入 ---
  useEffect(() => {
    if (isComposingRef.current) return;
    checkInputMatch(inputText);
  }, [inputText, referenceTokens]);


  // --- 核心演算法：輸入框智慧分詞 ---
  const getWordAtCursor = (text, index) => {
    if (!text) return '';
    const segmentLang = sourceLang;

    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        try {
            const segmenter = new Intl.Segmenter(segmentLang, { granularity: 'word' });
            const segments = segmenter.segment(text);
            for (const segment of segments) {
                if (index >= segment.index && index <= segment.index + segment.segment.length) {
                    if (segment.isWordLike || /[^\s\p{P}]/u.test(segment.segment)) {
                        return segment.segment;
                    }
                }
            }
            return ''; 
        } catch (e) { console.warn("Segmenter failed", e); }
    }
    const isSeparator = (char) => /[\s,.!?;:，。！？、：；「」『』()（）\n]/.test(char);
    if (index > 0 && isSeparator(text[index]) && !isSeparator(text[index - 1])) index--;
    else if (isSeparator(text[index])) return '';
    let start = index, end = index;
    while (start > 0 && !isSeparator(text[start - 1])) start--;
    while (end < text.length && !isSeparator(text[end])) end++;
    return text.substring(start, end);
  };

  // --- 處理輸入框游標移動 ---
  const handleCursorActivity = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    if (isComposingRef.current) {
        setIsInputTooltipVisible(false);
        return;
    }

    const index = textarea.selectionEnd;
    const wordUnderCursor = getWordAtCursor(textarea.value, index);
    
    if (wordUnderCursor !== currentWord) {
        setCurrentWord(wordUnderCursor);
        if (showFloatingTooltip && wordUnderCursor && wordUnderCursor.trim().length > 0) {
            setIsWordLoading(true);
            setIsInputTooltipVisible(true);
            if (wordDebounceTimerRef.current) clearTimeout(wordDebounceTimerRef.current);
            wordDebounceTimerRef.current = setTimeout(async () => {
                const res = await fetchTranslation(wordUnderCursor, 'word');
                setWordTranslation(res);
                setIsWordLoading(false);
            }, 300);
        } else {
            setIsInputTooltipVisible(false);
            setWordTranslation('');
        }
    }

    // 計算座標 (Mirror Logic)
    const mirror = mirrorRef.current;
    if (mirror) {
        const style = window.getComputedStyle(textarea);
        const props = [
            'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 
            'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 
            'borderWidth', 'boxSizing', 'whiteSpace', 'wordBreak', 'overflowWrap', 'textIndent',
            'textAlign', 'direction'
        ];
        
        props.forEach(key => {
            mirror.style[key] = style[key];
        });
        
        mirror.style.width = `${textarea.clientWidth}px`;
        
        if (style.wordBreak === 'normal' && style.overflowWrap === 'normal') {
             mirror.style.wordBreak = 'break-word'; 
        }

        mirror.textContent = textarea.value.substring(0, index);
        const span = document.createElement('span');
        span.textContent = '|';
        mirror.appendChild(span);
        
        const top = span.offsetTop - textarea.scrollTop;
        const left = span.offsetLeft - textarea.scrollLeft;
        const lineHeight = parseFloat(style.lineHeight) || 24; 
        
        setCursorPos({ top, left, height: lineHeight });

        if (practiceMode && referenceScrollRef.current) {
            const scrollPercentage = index / Math.max(inputText.length, 1);
            if (scrollPercentage > 0.8 || textarea.scrollTop > 50) {
                 const activeEl = referenceScrollRef.current.querySelector('.active-char');
                 if (activeEl) {
                     const container = referenceScrollRef.current;
                     const targetScroll = activeEl.offsetTop - container.clientHeight / 2;
                     if (Math.abs(container.scrollTop - targetScroll) > 50) {
                        container.scrollTo({ top: targetScroll, behavior: 'smooth' });
                     }
                 }
            }
        }
    }
  };

  // --- 處理範文互動 (Hover & Click) ---
  const handleReferenceInteraction = async (wordText, event, type = 'hover') => {
      // 邏輯控制：如果是 Hover 且 開關是關閉的，則不執行
      if (type === 'hover' && !hoverRefEnabled) return;

      if (type === 'click') event.stopPropagation();
      
      const scrollContainer = referenceScrollRef.current;
      if (!scrollContainer) return;

      const rect = event.target.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const top = rect.bottom - containerRect.top + scrollContainer.scrollTop;
      const left = rect.left - containerRect.left + scrollContainer.scrollLeft;

      const mockPhonetic = getMockPhonetic(wordText);

      setRefTooltipPos(prev => ({ 
          ...prev, 
          top: top + 8, 
          left: Math.min(left, containerRect.width - 200), 
          visible: true, 
          word: wordText, 
          translation: '...',
          phonetic: mockPhonetic 
      }));
      
      // 只有點擊時才發音
      if (type === 'click') {
          handleSpeak(wordText, sourceLang);
      }
      
      const translation = await fetchTranslation(wordText, 'word');
      setRefTooltipPos(prev => ({ ...prev, translation }));
  };

  useEffect(() => {
      const closeRefTooltip = () => setRefTooltipPos(prev => ({ ...prev, visible: false }));
      window.addEventListener('click', closeRefTooltip);
      return () => window.removeEventListener('click', closeRefTooltip);
  }, []);

  // --- 準確率計算 ---
  useEffect(() => {
    if (!practiceMode || !referenceText) return;
    let correctChars = 0;
    const len = Math.min(inputText.length, referenceText.length);
    for (let i = 0; i < len; i++) {
        if (inputText[i] === referenceText[i]) correctChars++;
    }
    const acc = len > 0 ? Math.round((correctChars / len) * 100) : 100;
    setAccuracy(acc);
  }, [inputText, referenceText, practiceMode]);

  // --- 翻譯 API ---
  const fetchTranslation = useCallback(async (text, type = 'sentence') => {
    if (!text || !text.trim()) return '';
    try {
      const srcCode = sourceLang === 'zh-TW' ? 'zh-TW' : sourceLang.split('-')[0];
      const tgtCode = targetLang === 'zh-TW' ? 'zh-TW' : targetLang.split('-')[0];
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcCode}|${tgtCode}`);
      const data = await response.json();
      if (data.responseStatus === 200) {
        if (usingOfflineMode) setUsingOfflineMode(false);
        return data.responseData.translatedText;
      } else { throw new Error(`API Status ${data.responseStatus}`); }
    } catch (error) {
      if (type === 'sentence') setUsingOfflineMode(true);
      const mockDictionary = { 'Accessibility': '無障礙', 'Essential': '必要的' };
      const key = Object.keys(mockDictionary).find(k => text.toLowerCase().includes(k.toLowerCase()));
      return key ? mockDictionary[key] : (targetLang.includes('zh') ? `[離線] ${text}` : text);
    }
  }, [sourceLang, targetLang, usingOfflineMode]);

  // --- 監聽句子翻譯 ---
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!inputText) { setTranslatedText(''); setIsLoading(false); return; }
    if (usingOfflineMode) setUsingOfflineMode(false);
    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      const result = await fetchTranslation(inputText, 'sentence');
      setTranslatedText(result);
      setIsLoading(false);
    }, 1000);
  }, [inputText, fetchTranslation]);

  // --- 檔案處理 ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceText(e.target.result);
        setInputText(''); setAccuracy(100);
        lastSpokenIndexRef.current = -1;
        setTimeout(() => inputRef.current?.focus(), 100);
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  const downloadSampleFile = () => {
    const text = `Title: Multi-Language Test
Type: Practice

こうした問題は解決できます。(Japanese)
今天天氣真好 (Chinese)
안녕하세요 (Korean)
Namaste (Hindi)
Guten Tag (German)
Hello World (English)
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'practice.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- 快捷鍵 ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); setPracticeMode(prev => !prev); }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSpeak(translatedText, targetLang); }
      if (e.altKey && e.key === 'Enter') { e.preventDefault(); handleSpeak(currentWord, sourceLang); }
      if (e.altKey && e.key === 'v') { e.preventDefault(); setShowReference(prev => !prev); }
      if (e.ctrlKey && e.key === 'i') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); fileInputRef.current?.click(); }
      if (e.ctrlKey && e.altKey && e.key === 'd') { e.preventDefault(); downloadSampleFile(); }
      if (e.key === 'Escape') { setInputText(''); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [translatedText, targetLang, practiceMode, currentWord, handleSpeak, sourceLang]);

  // --- 語言列表 ---
  const languages = [
    { code: 'en-US', name: 'English' },
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'ja-JP', name: '日本語' },
    { code: 'ko-KR', name: '한국어' },
    { code: 'vi-VN', name: 'Tiếng Việt' },
    { code: 'id-ID', name: 'Bahasa Indonesia' },
    { code: 'hi-IN', name: 'हिन्दी (Hindi)' },
    { code: 'pt-PT', name: 'Português' },
    { code: 'ar-SA', name: 'العربية' },
    { code: 'de-DE', name: 'Deutsch' },
    { code: 'ru-RU', name: 'Русский' },
    { code: 'es-ES', name: 'Español' },
    { code: 'fr-FR', name: 'Français' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-white overflow-hidden">
      
      {/* Header */}
      <header className="px-6 py-3 border-b border-slate-700 flex justify-between items-center bg-slate-800 shadow-md h-16 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg text-slate-900 transition-colors ${practiceMode ? 'bg-indigo-500' : 'bg-cyan-500'}`}>
            {practiceMode ? <BookOpen size={20} /> : <ScanText size={20} />}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              {practiceMode ? 'Typing Practice' : 'Keyboard Translator'}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {practiceMode && (
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded border border-slate-600">
                  <span className="text-xs text-slate-400">Accuracy</span>
                  <span className={`text-sm font-bold font-mono ${accuracy === 100 ? 'text-green-400' : accuracy > 80 ? 'text-yellow-400' : 'text-red-400'}`}>{accuracy}%</span>
              </div>
          )}
          
          <button onClick={() => setPracticeMode(!practiceMode)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${practiceMode ? 'bg-indigo-600 border-indigo-400 text-white' : 'border-slate-600 text-slate-400 hover:text-white'}`}>
             <BookOpen size={14} /> {practiceMode ? 'Mode: Practice' : 'Mode: Input'}
          </button>
          
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-600">
             <select ref={sourceLangRef} value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="bg-transparent text-xs px-2 py-1 outline-none cursor-pointer max-w-[80px]">{languages.map(l => <option key={`src-${l.code}`} value={l.code} className="bg-slate-800">{l.name}</option>)}</select>
             <ArrowRightLeft size={12} className="text-slate-500" />
             <select ref={targetLangRef} value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="bg-transparent text-xs px-2 py-1 outline-none cursor-pointer font-bold text-cyan-100 max-w-[80px]">{languages.map(l => <option key={`tgt-${l.code}`} value={l.code} className="bg-slate-800">{l.name}</option>)}</select>
          </div>
        </div>
      </header>

      {/* Main Content (Split Layout) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative p-4 gap-4 max-w-[1400px] mx-auto w-full">
        
        {/* LEFT PANEL: Reference Area */}
        {practiceMode && showReference && (
            <div 
                ref={referenceContainerRef}
                className="flex-1 min-h-[200px] bg-slate-800 border border-slate-700 rounded-xl p-0 relative group flex flex-col transition-all duration-300 shadow-lg"
            >
                <div className="h-10 flex justify-between items-center px-4 border-b border-slate-700/50 bg-slate-800/80 backdrop-blur rounded-t-xl z-10">
                    <span className="text-[10px] text-indigo-300 bg-indigo-900/50 px-2 py-1 rounded select-none uppercase font-bold flex items-center gap-2">
                        Reference Text 
                    </span>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setHoverRefEnabled(!hoverRefEnabled)} 
                            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${hoverRefEnabled ? 'text-indigo-300 bg-indigo-500/20' : 'text-slate-500 hover:text-slate-400'}`}
                            title="Toggle Translation on Hover"
                        >
                            <MousePointer2 size={12} /> {hoverRefEnabled ? 'Hover ON' : 'Hover OFF'}
                        </button>
                        <div className="w-[1px] h-3 bg-slate-700 my-auto"></div>
                        <button onClick={() => handleSpeak(referenceText, sourceLang)} className="text-slate-400 hover:text-indigo-400 transition-colors p-1" title="Read Full Text"><Volume2 size={16} /></button>
                        <button onClick={() => setShowReference(false)} className="text-slate-400 hover:text-white transition-colors p-1" title="Hide Reference (Alt+V)"><EyeOff size={16} /></button>
                    </div>
                </div>
                <div ref={referenceScrollRef} className="flex-1 overflow-auto custom-scrollbar font-mono text-lg leading-relaxed whitespace-pre-wrap relative p-4">
                    {referenceTokens.map((token, idx) => {
                         const chars = token.text.split('').map((char, charIdx) => {
                            const absoluteIndex = token.start + charIdx;
                            let statusClass = "text-slate-400"; 
                            if (absoluteIndex < inputText.length) {
                                statusClass = inputText[absoluteIndex] === char ? "text-emerald-400" : "text-red-400 bg-red-900/30";
                            } else if (absoluteIndex === inputText.length) {
                                // 範文游標 (Reference Cursor)
                                statusClass += " active-char border-l-2 border-cyan-500 bg-cyan-500/20 animate-pulse";
                            }
                            return <span key={charIdx} className={statusClass}>{char}</span>;
                        });

                        // 顯示空白符號 (Explicit Space)
                        if (/^\s+$/.test(token.text) && token.text.includes(' ')) {
                             return token.text.split('').map((char, charIdx) => {
                                 const absoluteIndex = token.start + charIdx;
                                 let spaceClass = "text-slate-700";
                                 if (absoluteIndex < inputText.length) {
                                     spaceClass = inputText[absoluteIndex] === ' ' ? "text-emerald-900/30" : "bg-red-500/50";
                                 } else if (absoluteIndex === inputText.length) {
                                     spaceClass += " border-l-2 border-cyan-500 bg-cyan-500/20 animate-pulse";
                                 }
                                 if (char === '\n') return <span key={charIdx} className="block w-full h-0 mb-2"></span>;
                                 return (
                                    <span key={charIdx} className={`inline-block w-2 text-center mx-[1px] rounded-sm select-none ${spaceClass}`}>
                                        <span className="opacity-30 text-[10px] align-middle">␣</span>
                                    </span>
                                 );
                             });
                        }

                        if (token.isWord) {
                            return (
                                <span 
                                    key={idx}
                                    onMouseEnter={(e) => handleReferenceInteraction(token.text, e, 'hover')}
                                    onClick={(e) => handleReferenceInteraction(token.text, e, 'click')}
                                    // 修正: CJK 不加 margin, 英文單字加
                                    className={`cursor-pointer hover:bg-slate-700/50 hover:text-cyan-200 transition-colors inline-block rounded px-0.5 border-b border-transparent hover:border-slate-600 ${token.isCJK ? '' : 'mr-0'}`}
                                    title="Click for translation & phonetic"
                                >
                                    {chars}
                                </span>
                            );
                        } else {
                            return <span key={idx} className="inline-block">{chars}</span>;
                        }
                    })}

                    {refTooltipPos.visible && (
                        <div 
                            className="absolute z-50 animate-in fade-in zoom-in-95 duration-100 pointer-events-none"
                            style={{ top: refTooltipPos.top, left: refTooltipPos.left }}
                        >
                            <div className="bg-indigo-900/95 backdrop-blur border border-indigo-500/50 text-slate-100 rounded-lg shadow-xl px-3 py-2 min-w-[150px] max-w-[250px] pointer-events-auto">
                                <div className="flex items-center justify-between mb-1 gap-2">
                                    <div className="text-xs text-indigo-300 font-bold font-mono truncate">{refTooltipPos.word}</div>
                                    <button 
                                        className="text-indigo-300 hover:text-white pointer-events-auto"
                                        onClick={(e) => { e.stopPropagation(); handleSpeak(refTooltipPos.word, sourceLang); }}
                                    >
                                        <Volume2 size={12}/>
                                    </button>
                                </div>
                                {refTooltipPos.phonetic ? (
                                    <div className="text-[10px] text-emerald-300 italic mb-1 border-b border-indigo-500/30 pb-1">
                                        {refTooltipPos.phonetic}
                                    </div>
                                ) : (
                                    <div className="text-[9px] text-slate-500 mb-1 flex items-center gap-1 cursor-pointer hover:text-indigo-300 pointer-events-auto" onClick={(e) => {e.stopPropagation(); handleSpeak(refTooltipPos.word, sourceLang)}}>
                                        <Volume2 size={8} /> Click to Listen
                                    </div>
                                )}
                                <div className="text-sm font-medium text-white">{refTooltipPos.translation}</div>
                                <div className="absolute -top-1 left-4 w-2 h-2 bg-indigo-900 border-t border-l border-indigo-500/50 rotate-45"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* RIGHT PANEL: Input Area */}
        <div className={`relative flex-1 min-h-[200px] bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-inner flex flex-col transition-all duration-300 ${!showReference ? 'md:flex-[2]' : ''}`}>
            
            <div className="h-10 bg-slate-900/30 border-b border-slate-700/50 flex items-center justify-between px-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Your Input</span>
                    <button 
                        onClick={() => setShowFloatingTooltip(!showFloatingTooltip)} 
                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${showFloatingTooltip ? 'text-cyan-400 bg-cyan-900/20' : 'text-slate-500 bg-slate-800'}`}
                        title="Toggle Cursor Translation Tooltip"
                    >
                        {showFloatingTooltip ? <MessageSquare size={10} /> : <MessageSquareOff size={10} />}
                        {showFloatingTooltip ? 'Tooltip ON' : 'OFF'}
                    </button>
                    
                    <button 
                        onClick={() => setAutoSpeakWord(!autoSpeakWord)} 
                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${autoSpeakWord ? 'text-emerald-400 bg-emerald-900/20' : 'text-slate-500 bg-slate-800'}`}
                        title="Auto-speak when word is completed correctly"
                    >
                        {autoSpeakWord ? <Volume2 size={10} /> : <Volume1 size={10} />}
                        {autoSpeakWord ? 'Auto Word' : 'Auto Word OFF'}
                    </button>

                    {!showReference && practiceMode && (
                        <button onClick={() => setShowReference(true)} className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-900/20 px-2 py-0.5 rounded hover:bg-indigo-900/40" title="Show Reference (Alt+V)"><Eye size={10} /> Show Ref</button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => handleSpeak(inputText, sourceLang)} className="text-slate-400 hover:text-cyan-400 transition-colors p-1" title="Read Input Text"><Volume2 size={14} /></button>
                    <div className="w-[1px] h-3 bg-slate-700"></div>
                    <button onClick={downloadSampleFile} className="text-slate-400 hover:text-white p-1" title="Download Sample"><Download size={14} /></button>
                    <button onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-white p-1" title="Upload File"><Upload size={14} /></button>
                    <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                </div>
            </div>

            <div className="relative flex-1 overflow-hidden">
                <div ref={mirrorRef} className="absolute top-0 left-0 p-4 w-full text-lg font-mono leading-relaxed whitespace-pre-wrap invisible pointer-events-none font-sans" style={{ zIndex: -10 }} />

                <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => { setInputText(e.target.value); handleCursorActivity(); }}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    onKeyUp={handleCursorActivity}
                    onClick={handleCursorActivity}
                    onScroll={handleCursorActivity}
                    placeholder="Type here..."
                    className="w-full h-full bg-transparent p-4 text-lg font-mono leading-relaxed resize-none outline-none text-slate-200 caret-cyan-500 font-sans overflow-auto custom-scrollbar"
                    autoFocus
                    spellCheck={false}
                />
            </div>

            {/* Input Floating Tooltip - Positioned BELOW line (top + height) */}
            {showFloatingTooltip && isInputTooltipVisible && (
                <div 
                    className="absolute z-50 transition-all duration-100 ease-out pointer-events-none"
                    style={{ 
                        // Position below the line to avoid blocking text/IME
                        top: cursorPos.top + cursorPos.height + 5,
                        left: Math.max(0, Math.min(cursorPos.left, inputRef.current?.clientWidth - 220 || 0)),
                    }}
                >
                    <div className="bg-slate-900/95 backdrop-blur border border-cyan-500/50 text-slate-100 rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-150 w-max max-w-[240px] flex flex-col overflow-hidden pointer-events-auto">
                         <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700/50">
                             <div className="text-xs text-cyan-400 font-bold font-mono truncate mr-2">{currentWord}</div>
                             <div className="flex gap-1">
                                <span className="text-[9px] text-slate-500 border border-slate-700 px-1 rounded flex items-center">Alt+Enter</span>
                                <button onClick={(e) => { e.stopPropagation(); handleSpeak(currentWord, sourceLang); }} className="text-slate-400 hover:text-white transition-colors shrink-0" title="Pronounce Word"><Volume2 size={14} /></button>
                             </div>
                         </div>
                         <div className="px-3 py-2 text-sm font-medium text-white break-words leading-tight">
                            {isWordLoading ? <div className="flex items-center gap-2 text-slate-400"><Loader2 size={12} className="animate-spin" /> Translating...</div> : (wordTranslation || '...')}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* 3. Sentence Translation */}
    </main>
    <div className="h-[140px] mx-4 mb-4 bg-slate-900 border border-slate-700 rounded-xl p-0 flex flex-col shrink-0 relative shadow-lg">
             <div className="h-8 bg-slate-950/30 border-b border-slate-800 flex items-center justify-between px-4">
                 <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-cyan-500" /> Sentence Translation
                    {usingOfflineMode && <span className="text-orange-400 flex items-center gap-1 bg-orange-900/20 px-2 py-0.5 rounded border border-orange-500/30"><WifiOff size={10}/> Offline</span>}
                 </div>
             </div>
             <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                 <p className="text-slate-300 text-lg leading-relaxed font-sans">
                    {isLoading ? <span className="animate-pulse text-slate-500">Translating...</span> : (translatedText || <span className="text-slate-700 italic">Start typing to see sentence translation...</span>)}
                 </p>
             </div>
             <button onClick={() => handleSpeak(translatedText, targetLang)} disabled={!translatedText} className="absolute bottom-4 right-4 p-2 bg-slate-800 hover:bg-cyan-600 rounded-full text-white transition-colors disabled:opacity-0 border border-slate-700 shadow-lg" title="Read Translation (Ctrl+Enter)"><Volume2 size={18} /></button>
    </div>

      {showShortcuts && (
        <div className="fixed bottom-4 left-4 z-50 opacity-50 hover:opacity-100 transition-opacity pointer-events-none">
           <div className="bg-black/80 backdrop-blur text-[10px] text-slate-400 px-3 py-1 rounded-full border border-slate-700 flex gap-3">
              <span>Ctrl+P: Practice</span>
              <span>Alt+V: Toggle Ref</span>
              <span>Alt+Enter: Speak Word</span>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default App;