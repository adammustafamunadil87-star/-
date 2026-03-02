import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Play, RotateCcw, ArrowLeft, ArrowRight, Zap, Key, Lock, Pause } from 'lucide-react';
import { GameEngine, GameState } from './gameEngine';
import { speakAngryPolice } from './services/ttsService';
import { gameMusic } from './services/musicService';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    coins: 0,
    isGameOver: false,
    isStarted: false,
    distance: 0,
    isHoverboardActive: false,
    hoverboardTimeLeft: 0
  });

  const [totalCoins, setTotalCoins] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [accessories, setAccessories] = useState({ 
    hat: true, 
    shoes: false, 
    shirtColor: 0xff4444,
    hatColor: 0x333333,
    shoeColor: 0xffffff,
    pantsColor: 0x333333
  });
  const [gameOverStage, setGameOverStage] = useState<'caught' | 'jail' | 'escaped'>('caught');

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      gameRef.current = new GameEngine(containerRef.current, (state) => {
        setGameState(prev => {
          if (!prev.isGameOver && state.isGameOver) {
            setGameOverStage('caught');
          }
          // Update total coins when game ends or coins are collected
          if (state.coins > prev.coins) {
            setTotalCoins(t => t + (state.coins - prev.coins));
          }
          return { ...prev, ...state };
        });
      });
    }
  }, []);

  useEffect(() => {
    if (gameState.isGameOver && gameOverStage === 'caught') {
      const name = playerName || 'يا بطل';
      speakAngryPolice(`فشلت يا ${name}! لقد حذرتك من الرسم على الجدران... الشرطي يمسكك من أذنيك بقوة!`);
    }
  }, [gameState.isGameOver, gameOverStage, playerName]);

  const handleStart = () => {
    if (gameRef.current) {
      gameRef.current.setAccessories(
        accessories.hat, 
        accessories.shoes, 
        accessories.shirtColor,
        accessories.hatColor,
        accessories.shoeColor,
        accessories.pantsColor
      );
      gameRef.current.start();
      gameMusic.start();
      setGameState(prev => ({ ...prev, isStarted: true }));
    }
  };

  const toggleAccessory = (type: 'hat' | 'shoes') => {
    setAccessories(prev => {
      const next = { ...prev, [type]: !prev[type] };
      if (gameRef.current) {
        gameRef.current.setAccessories(
          next.hat, 
          next.shoes, 
          next.shirtColor,
          next.hatColor,
          next.shoeColor,
          next.pantsColor
        );
      }
      return next;
    });
  };

  const changeColor = (type: 'shirt' | 'hat' | 'shoe' | 'pants', color: number) => {
    setAccessories(prev => {
      const next = { ...prev, [`${type}Color`]: color };
      if (gameRef.current) {
        gameRef.current.setAccessories(
          next.hat, 
          next.shoes, 
          next.shirtColor,
          next.hatColor,
          next.shoeColor,
          next.pantsColor
        );
      }
      return next;
    });
  };

  const hexToNum = (hex: string) => parseInt(hex.replace('#', ''), 16);
  const numToHex = (num: number) => `#${num.toString(16).padStart(6, '0')}`;

  const ColorSection = ({ title, type, currentColor }: { title: string, type: 'shirt' | 'hat' | 'shoe' | 'pants', currentColor: number }) => {
    const palette = [
      0xff4444, 0xff8800, 0xffff44, 0x44ff44, 
      0x44ffff, 0x4444ff, 0x8844ff, 0xff44ff, 
      0xffffff, 0x888888, 0x333333, 0x8b4513,
      0x4b0082, 0xe6e6fa, 0x008080, 0xffd700,
      0xaaff00, 0x000000
    ];

    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] p-5">
        <div className="text-white/70 text-[10px] uppercase tracking-widest font-bold mb-4 text-center">{title}</div>
        <div className="flex flex-col items-center gap-4">
          <div className="grid grid-cols-6 gap-3">
            {palette.map((color) => (
              <button
                key={color}
                onClick={() => changeColor(type, color)}
                className={`w-10 h-10 rounded-full border-4 transition-all ${currentColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: numToHex(color) }}
              />
            ))}
            
            {/* Custom Color Picker Circle */}
            <label className="relative cursor-pointer group">
              <input 
                type="color" 
                value={numToHex(currentColor)}
                onChange={(e) => changeColor(type, hexToNum(e.target.value))}
                className="sr-only"
              />
              <div 
                className={`w-10 h-10 rounded-full border-4 transition-all flex items-center justify-center overflow-hidden shadow-inner ${!palette.includes(currentColor) ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: numToHex(currentColor) }}
              >
                <div className="w-full h-full opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap size={14} className="text-white drop-shadow-md" fill="currentColor" />
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    );
  };

  const handleRestart = () => {
    if (gameRef.current) {
      gameRef.current.reset();
      gameRef.current.start();
      gameMusic.start();
      setGameOverStage('none');
    }
  };

  const handlePause = () => {
    if (gameRef.current) {
      gameRef.current.pause();
      gameMusic.stop();
    }
  };

  const handleResume = () => {
    if (gameRef.current) {
      gameRef.current.resume();
      gameMusic.start();
    }
  };

  const handleBackToMenu = () => {
    if (gameRef.current) {
      gameRef.current.reset();
      gameMusic.stop();
      setGameState(prev => ({
        ...prev,
        isStarted: false,
        isPaused: false,
        isGameOver: false,
        score: 0,
        coins: 0
      }));
    }
  };

  const goToJail = () => {
    setGameOverStage('jail');
    gameMusic.stop();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-sky-400 font-sans">
      {/* Game Canvas Container */}
      <div ref={containerRef} className="w-full h-full" id="game-canvas" />

      {/* HUD */}
      {gameState.isStarted && !gameState.isGameOver && (
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
          <div className="flex gap-4 items-start pointer-events-auto">
            <button 
              onClick={handlePause}
              className="bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white hover:bg-white/20 transition-colors shadow-lg"
            >
              <Pause size={24} fill="currentColor" />
            </button>

            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col gap-1"
            >
              <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-widest font-bold">
                <Trophy size={14} />
                النتيجة
              </div>
              <div className="text-3xl font-black text-white tabular-nums">
                {gameState.score.toLocaleString()}
              </div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col gap-1 items-end"
          >
            <div className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-widest font-bold">
              العملات
              <Coins size={14} className="text-yellow-400" />
            </div>
            <div className="text-3xl font-black text-white tabular-nums">
              {gameState.coins}
            </div>
          </motion.div>

          {/* Hoverboard Timer */}
          <AnimatePresence>
            {gameState.isHoverboardActive && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, x: -100 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, x: -100 }}
                className="absolute top-32 left-6 bg-emerald-500/80 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center gap-4 shadow-lg"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <Zap size={24} className="text-white fill-current" />
                </div>
                <div>
                  <div className="text-white/70 text-[10px] uppercase tracking-widest font-bold">سكوتير طائر</div>
                  <div className="text-2xl font-black text-white tabular-nums leading-none">
                    {gameState.hoverboardTimeLeft}s
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pause Screen */}
      <AnimatePresence>
        {gameState.isPaused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <h2 className="text-6xl font-black text-white mb-12 tracking-tighter">اللعبة متوقفة</h2>
              
              <div className="flex flex-col gap-6 w-full max-w-xs mx-auto">
                <button 
                  onClick={handleResume}
                  className="group relative w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-6 rounded-[2rem] text-2xl transition-all active:scale-95 shadow-[0_8px_0_rgb(5,150,105)] hover:shadow-[0_4px_0_rgb(5,150,105)] hover:translate-y-[4px] active:shadow-none active:translate-y-[8px]"
                >
                  <div className="flex items-center justify-center gap-4">
                    <Play size={32} fill="currentColor" />
                    استئناف
                  </div>
                </button>

                <button 
                  onClick={handleRestart}
                  className="group relative w-full bg-white/10 hover:bg-white/20 text-white font-black py-6 rounded-[2rem] text-2xl transition-all active:scale-95 border-2 border-white/20"
                >
                  <div className="flex items-center justify-center gap-4">
                    <RotateCcw size={32} />
                    إعادة المحاولة
                  </div>
                </button>

                <button 
                  onClick={handleBackToMenu}
                  className="group relative w-full bg-white/5 hover:bg-white/10 text-white/70 font-black py-4 rounded-[2rem] text-xl transition-all active:scale-95 border border-white/10"
                >
                  <div className="flex items-center justify-center gap-4">
                    <ArrowLeft size={24} />
                    القائمة الرئيسية
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Screen */}
      <AnimatePresence>
        {!gameState.isStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm overflow-y-auto z-50"
          >
            <div className="min-h-full flex flex-col items-center justify-between py-12 gap-12">
              {/* Top Section: Title & Total Coins */}
              <motion.div 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center"
              >
                <h1 className="text-7xl font-black text-white mb-2 tracking-tighter drop-shadow-2xl">عداء المدينة</h1>
                <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-6 py-2 inline-flex items-center gap-3 shadow-xl">
                  <Coins size={24} className="text-yellow-400" />
                  <span className="text-2xl font-black text-white tabular-nums">{totalCoins}</span>
                </div>
              </motion.div>

              {/* Name Input */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-sm px-6"
              >
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] p-6 text-center">
                  <label className="text-white/70 text-[10px] uppercase tracking-widest font-bold mb-4 block">أدخل اسمك</label>
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="اكتب اسمك هنا..."
                    className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-white text-xl font-black placeholder:text-white/30 focus:outline-none focus:border-emerald-500 transition-all text-center"
                  />
                </div>
              </motion.div>

              {/* Controls Guide */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-lg px-6 grid grid-cols-2 gap-4"
              >
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-4 flex flex-col items-center gap-2">
                  <div className="text-white/50 text-[10px] uppercase font-bold">ويندوز (Windows)</div>
                  <div className="flex gap-2">
                    <div className="bg-white/20 px-2 py-1 rounded text-white text-xs font-bold border border-white/30">Arrows</div>
                    <div className="bg-white/20 px-2 py-1 rounded text-white text-xs font-bold border border-white/30">WASD</div>
                    <div className="bg-white/20 px-2 py-1 rounded text-white text-xs font-bold border border-white/30">Space</div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-4 flex flex-col items-center gap-2">
                  <div className="text-white/50 text-[10px] uppercase font-bold">أندرويد (Android)</div>
                  <div className="flex gap-2">
                    <div className="bg-white/20 px-2 py-1 rounded text-white text-xs font-bold border border-white/30">Swipe</div>
                    <div className="bg-white/20 px-2 py-1 rounded text-white text-xs font-bold border border-white/30">Buttons</div>
                  </div>
                </div>
              </motion.div>

              {/* Middle Section: Accessories Shop */}
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col gap-6 w-full max-w-lg px-6"
              >
              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => toggleAccessory('shoes')}
                  className={`relative p-4 rounded-3xl border-4 transition-all ${accessories.shoes ? 'bg-blue-500 border-white shadow-lg scale-105' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <div className="flex gap-1">
                        <div className="w-3 h-5 bg-white rounded-sm" />
                        <div className="w-3 h-5 bg-white rounded-sm" />
                      </div>
                    </div>
                    <span className="text-white font-black text-sm">أحذية (اختياري)</span>
                  </div>
                  {accessories.shoes && <div className="absolute -top-2 -right-2 bg-white text-blue-500 rounded-full p-1 shadow-md"><Zap size={12} fill="currentColor" /></div>}
                </button>
              </div>

              {/* Shirt Color Selection */}
              <ColorSection title="لون القميص" type="shirt" currentColor={accessories.shirtColor} />

              {/* Pants Color Selection */}
              <ColorSection title="لون البجامة (البنطلون)" type="pants" currentColor={accessories.pantsColor} />

              {/* Hat Color Selection */}
              <ColorSection title="لون القبعة" type="hat" currentColor={accessories.hatColor} />

              {/* Shoe Color Selection */}
              {accessories.shoes && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <ColorSection title="لون الحذاء" type="shoe" currentColor={accessories.shoeColor} />
                </motion.div>
              )}
            </motion.div>

            {/* Bottom Section: Start Button */}
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-md px-6"
            >
              <button 
                onClick={handleStart}
                className="group relative w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-8 rounded-[2.5rem] text-3xl transition-all active:scale-95 shadow-[0_12px_0_rgb(5,150,105)] hover:shadow-[0_8px_0_rgb(5,150,105)] hover:translate-y-[4px] active:shadow-none active:translate-y-[12px]"
              >
                <div className="flex items-center justify-center gap-4">
                  <Play size={40} fill="currentColor" />
                  ابدأ اللعب
                </div>
              </button>
              <p className="text-white/50 text-center mt-8 font-bold uppercase tracking-widest text-xs">اضغط للبدء والهروب من الشرطي</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Game Over Screen - Jail Sequence */}
      <AnimatePresence>
        {gameState.isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 overflow-hidden"
          >
            {gameOverStage === 'caught' && (
              <motion.div 
                key="caught"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="text-center px-6"
              >
                <div className="relative mb-8">
                  <motion.div 
                    animate={{ x: [0, 10, -10, 0], rotate: [0, 2, -2, 0] }}
                    transition={{ repeat: Infinity, duration: 0.2 }}
                    className="text-7xl md:text-9xl font-black text-red-600 uppercase tracking-tighter drop-shadow-[0_5px_15px_rgba(220,38,38,0.5)]"
                  >
                    فشلت يا {playerName || 'بطل'}!
                  </motion.div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 mb-12">
                  <p className="text-white text-3xl font-black mb-4">الشرطي يمسكك من أذنيك بقوة!</p>
                  <p className="text-white/70 text-xl font-bold">"لقد حذرتك من الرسم على الجدران..."</p>
                </div>
                <button 
                  onClick={goToJail}
                  className="group relative bg-white text-black font-black px-16 py-8 rounded-full text-3xl hover:bg-gray-200 transition-all active:scale-95 shadow-[0_10px_0_rgb(200,200,200)] hover:shadow-[0_5px_0_rgb(200,200,200)] hover:translate-y-[5px] active:shadow-none active:translate-y-[10px]"
                >
                  إلى السجن ➔
                </button>
              </motion.div>
            )}

            {gameOverStage === 'jail' && (
              <motion.div 
                key="jail"
                initial={{ y: 500 }}
                animate={{ y: 0 }}
                className="relative w-full h-full flex items-center justify-center"
              >
                {/* Jail Bars */}
                <div className="absolute inset-0 flex justify-around pointer-events-none z-10">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="w-4 h-full bg-gradient-to-r from-gray-700 via-gray-400 to-gray-700 shadow-xl" />
                  ))}
                </div>

                <div className="bg-gray-900/90 p-12 rounded-[3rem] border-4 border-gray-700 text-center relative z-20 max-w-lg w-full mx-4">
                  <div className="mb-8 flex justify-center">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <Lock size={100} className="text-gray-600" />
                      
                      {/* Hidden Key Mechanic */}
                      <motion.div 
                        initial={{ opacity: 0, scale: 0, x: 100, y: 100 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1, 
                          x: [100, -150, 120, 0],
                          y: [100, -80, 150, 0]
                        }}
                        transition={{ 
                          delay: 1.5, 
                          duration: 2, 
                          times: [0, 0.3, 0.7, 1],
                          ease: "easeInOut"
                        }}
                        className="absolute"
                      >
                        <button 
                          onClick={handleRestart}
                          className="w-24 h-24 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.5)] hover:scale-110 transition-transform active:scale-90 group border-4 border-white/30"
                        >
                          <Key size={48} className="text-black group-hover:rotate-45 transition-transform drop-shadow-md" />
                        </button>
                      </motion.div>
                    </div>
                  </div>
                  
                  <h2 className="text-5xl font-black text-white mb-6 tracking-tight">أنت خلف القضبان!</h2>
                  <p className="text-gray-400 text-xl mb-10 font-medium">أسرع! ابحث عن المفتاح الذي سقط من الحارس للهرب...</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-gray-800 p-4 rounded-2xl">
                      <div className="text-gray-500 text-xs font-bold uppercase mb-1">النتيجة</div>
                      <div className="text-2xl font-black text-white">{gameState.score.toLocaleString()}</div>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-2xl">
                      <div className="text-gray-500 text-xs font-bold uppercase mb-1">العملات</div>
                      <div className="text-2xl font-black text-white">{gameState.coins}</div>
                    </div>
                  </div>

                  <p className="text-yellow-400 font-bold animate-bounce">اضغط على المفتاح للهرب!</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controls Overlay (Visible only on touch devices) */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-between px-10 pointer-events-none sm:hidden">
        <div className="flex flex-col gap-4">
          <button 
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center pointer-events-auto active:scale-90 transition-transform shadow-xl"
            onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))}
          >
            <ArrowLeft size={32} className="text-white" />
          </button>
          <button 
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center pointer-events-auto active:scale-90 transition-transform shadow-xl"
            onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))}
          >
            <div className="w-8 h-4 bg-white rounded-full" />
          </button>
        </div>
        
        <div className="flex flex-col gap-4 items-end">
          <button 
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center pointer-events-auto active:scale-90 transition-transform shadow-xl"
            onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))}
          >
            <ArrowRight size={32} className="text-white" />
          </button>
          <button 
            className="w-20 h-20 rounded-full bg-emerald-500/50 backdrop-blur-md border-4 border-white/30 flex items-center justify-center pointer-events-auto active:scale-90 transition-transform shadow-xl"
            onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))}
          >
            <Play size={32} className="text-white -rotate-90" fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
