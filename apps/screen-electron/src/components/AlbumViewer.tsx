import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface Photo {
  id: string;
  url: string;
  path: string;
  desc: string;
}

export interface Album {
  id: string;
  name: string;
  desc: string;
  photos: Photo[];
  coverUrl?: string;
}

type PlaybackSlide = 
  | { type: 'BANNER'; album: Album }
  | { type: 'PHOTO'; album: Album; photos: Photo[]; layout: 'single' | 'double' | 'triple' };

export function AlbumViewer() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [viewMode, setViewMode] = useState<'LIST' | 'ALBUM' | 'PLAY'>('LIST');
  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null);
  const [localIP, setLocalIP] = useState<string>('127.0.0.1');

  useEffect(() => {
    if ((window as any).electronAPI?.getLocalIP) {
      (window as any).electronAPI.getLocalIP().then((ip: string) => {
        setLocalIP(ip);
      }).catch((err: any) => console.error('Failed to get local IP', err));
    }
  }, []);

  const [bgmUrl, setBgmUrl] = useState<string>('./music.mp3');

  // Modals state
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [editAlbumInfo, setEditAlbumInfo] = useState<{name: string; desc: string}>({ name: '', desc: '' });
  
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [editPhotoInfo, setEditPhotoInfo] = useState<{id: string; desc: string}>({ id: '', desc: '' });

  // Playback state map
  const [slides, setSlides] = useState<PlaybackSlide[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [animationClass, setAnimationClass] = useState('zoom-in');
  const [textAnimationClass, setTextAnimationClass] = useState('text-anim-fly-up');

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    if (window.electronAPI && window.electronAPI.getAlbums) {
      const data = await window.electronAPI.getAlbums();
      setAlbums(data || []);
    }
  };

  const saveAlbums = async (newAlbums: Album[]) => {
    setAlbums(newAlbums);
    if (window.electronAPI && window.electronAPI.saveAlbums) {
      await window.electronAPI.saveAlbums(newAlbums);
    }
  };

  const handleSelectBgm = async () => {
    if (window.electronAPI && window.electronAPI.selectAudioFile) {
      const url = await window.electronAPI.selectAudioFile();
      if (url) setBgmUrl(url);
    }
  };

  // -------------------------
  // Album Actions
  // -------------------------
  const handleCreateAlbumClick = () => {
    setEditAlbumInfo({ name: '', desc: '' });
    setIsAlbumModalOpen(true);
  };

  const handleSaveAlbum = () => {
    if (!editAlbumInfo.name.trim()) return;
    const newAlbum: Album = {
      id: Date.now().toString(),
      name: editAlbumInfo.name,
      desc: editAlbumInfo.desc,
      photos: []
    };
    saveAlbums([...albums, newAlbum]);
    setIsAlbumModalOpen(false);
  };

  const handleDeleteAlbum = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个相册吗？')) {
      const newAlbums = albums.filter(a => a.id !== id);
      saveAlbums(newAlbums);
    }
  };

  const openAlbum = (id: string) => {
    setCurrentAlbumId(id);
    setViewMode('ALBUM');
  };

  // -------------------------
  // Photo Actions
  // -------------------------
  const handleAddPhotos = async () => {
    if (!window.electronAPI || !currentAlbumId) return;
    const dirPath = await window.electronAPI.selectAlbumDirectory();
    if (!dirPath) return;
    const files = await window.electronAPI.readAlbumFiles(dirPath);
    if (!files || files.length === 0) return;

    const newPhotos: Photo[] = files.map((f: any) => ({
      id: Date.now() + Math.random().toString(),
      url: f.url,
      path: f.path,
      desc: ''
    }));

    const newAlbums = albums.map(a => {
      if (a.id === currentAlbumId) {
        return { 
          ...a, 
          photos: [...a.photos, ...newPhotos],
          coverUrl: a.coverUrl || newPhotos[0]?.url 
        };
      }
      return a;
    });
    saveAlbums(newAlbums);
  };

  const handleEditPhotoClick = (e: React.MouseEvent, photo: Photo) => {
    e.stopPropagation();
    setEditPhotoInfo({ id: photo.id, desc: photo.desc || '' });
    setIsPhotoModalOpen(true);
  };

  const handleSavePhotoDesc = () => {
    const newAlbums = albums.map(a => {
      if (a.id === currentAlbumId) {
        return {
          ...a,
          photos: a.photos.map(p => p.id === editPhotoInfo.id ? { ...p, desc: editPhotoInfo.desc } : p)
        };
      }
      return a;
    });
    saveAlbums(newAlbums);
    setIsPhotoModalOpen(false);
  };

  const handleDeletePhoto = (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这张照片吗？')) {
      const newAlbums = albums.map(a => {
        if (a.id === currentAlbumId) {
          const newPhotos = a.photos.filter(p => p.id !== photoId);
          return { ...a, photos: newPhotos, coverUrl: newPhotos.length > 0 ? newPhotos[0].url : undefined };
        }
        return a;
      });
      saveAlbums(newAlbums);
    }
  };

  // -------------------------
  // Playback Logic
  // -------------------------
  const buildSlides = (targetAlbums: Album[]) => {
    const newSlides: PlaybackSlide[] = [];
    for (const album of targetAlbums) {
      if (album.photos.length === 0) continue;
      // Start with banner
      newSlides.push({ type: 'BANNER', album });
      
      // Chunk photos (randomly 1, 2, or 3)
      let pIdx = 0;
      while (pIdx < album.photos.length) {
        const remaining = album.photos.length - pIdx;
        
        let takeCount = 1;
        if (remaining >= 3) {
          const rand = Math.random();
          if (rand > 0.7) takeCount = 3;         // 30% chance for triple
          else if (rand > 0.4) takeCount = 2;    // 30% chance for double
        } else if (remaining === 2) {
          if (Math.random() > 0.5) takeCount = 2; // 50% chance for double if 2 left
        }

        if (takeCount === 3) {
          newSlides.push({ type: 'PHOTO', album, photos: [album.photos[pIdx], album.photos[pIdx+1], album.photos[pIdx+2]], layout: 'triple' });
          pIdx += 3;
        } else if (takeCount === 2) {
          newSlides.push({ type: 'PHOTO', album, photos: [album.photos[pIdx], album.photos[pIdx+1]], layout: 'double' });
          pIdx += 2;
        } else {
          newSlides.push({ type: 'PHOTO', album, photos: [album.photos[pIdx]], layout: 'single' });
          pIdx += 1;
        }
      }
    }
    return newSlides;
  };

  const startPlayback = (all: boolean = false) => {
    const targetAlbums = all ? albums : albums.filter(a => a.id === currentAlbumId);
    const generatedSlides = buildSlides(targetAlbums);
    if (generatedSlides.length === 0) {
      alert("没有可播放的照片，请先上传");
      return;
    }
    setSlides(generatedSlides);
    setSlideIndex(0);
    setViewMode('PLAY');
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (viewMode === 'PLAY' && slides.length > 0) {
      const currentSlide = slides[slideIndex];
      const duration = currentSlide.type === 'BANNER' ? 3000 : 7000; // Banner is fast, photos are slow
      
      timer = setTimeout(() => {
        setSlideIndex(prev => (prev + 1) % slides.length);
        const classes = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'];
        const textClasses = ['text-anim-fly-up', 'text-anim-fly-down', 'text-anim-fly-left', 'text-anim-fly-right', 'text-anim-fade-zoom'];
        setAnimationClass(classes[Math.floor(Math.random() * classes.length)]);
        setTextAnimationClass(textClasses[Math.floor(Math.random() * textClasses.length)]);
      }, duration);
    }
    return () => clearTimeout(timer);
  }, [viewMode, slideIndex, slides]);

  const currentAlbum = albums.find(a => a.id === currentAlbumId);
  const playSlide = slides[slideIndex];

  return (
    <>
      {viewMode !== 'PLAY' && (
        <div className="album-manager">
          
          {/* LIST MODE */}
          {viewMode === 'LIST' && (
            <>
              <div className="album-header">
                <h2>我的相册</h2>
                <div style={{display:'flex', gap:'12px'}}>
                  <button className="primary-btn" onClick={handleSelectBgm} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    ♫ 设置循环BGM
                  </button>
                  <button className="btn-create-album" onClick={handleCreateAlbumClick}>
                    + 新建相册
                  </button>
                  {albums.some(a => a.photos.length > 0) && (
                    <button className="play-all-btn" onClick={() => startPlayback(true)}>
                      ▶ 轮播所有相册
                    </button>
                  )}
                </div>
              </div>

              {albums.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.6)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>📦</div>
                  <h3 style={{ fontSize: '24px', marginBottom: '10px', color: 'white' }}>欢迎使用相册，这里空空如也~</h3>
                  <p style={{ fontSize: '16px', maxWidth: '400px', textAlign: 'center', lineHeight: '1.6' }}>
                    您可以通过右上角的 <strong>+ 新建相册</strong> 来创建一个照片集，然后在里面导入您的回忆。<br />
                    导入照片后可双击照片添加描述文字。还可以在右上角设置背景音乐！
                  </p>
                </div>
              ) : (
                <div className="album-grid">
                  {albums.map(album => (
                    <div key={album.id} className="album-card" onClick={() => openAlbum(album.id)}>
                    {album.coverUrl ? (
                      <img src={album.coverUrl} alt="cover" />
                    ) : (
                      <div style={{width:'100%', height:'180px', background:'rgba(255,255,255,0.1)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'10px'}}>无照片</div>
                    )}
                    <div className="album-card-title">{album.name}</div>
                    <div className="album-card-desc">{album.desc || '暂无描述'} ({album.photos?.length || 0}张)</div>
                    <div className="album-actions">
                      <button onClick={(e) => handleDeleteAlbum(e, album.id)}>删除相册</button>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </>
          )}

          {/* ALBUM MODE */}
          {viewMode === 'ALBUM' && currentAlbum && (
            <>
              <div className="album-header">
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                  <button onClick={() => setViewMode('LIST')} style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', border:'none', color:'white', borderRadius:'6px', cursor:'pointer'}}>返回</button>
                  <div>
                    <h2 style={{margin:0}}>{currentAlbum.name}</h2>
                    <p style={{margin:0, fontSize:'14px', color:'#aaa', marginTop:'4px'}}>{currentAlbum.desc}</p>
                  </div>
                </div>
                <div style={{display:'flex', gap:'12px'}}>
                  <button onClick={handleAddPhotos} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    + 导入图片(选取文件夹)
                  </button>
                  {currentAlbum.photos.length > 0 && (
                    <button onClick={() => startPlayback(false)} style={{ padding: '10px 20px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                      ▶ 播放相册
                    </button>
                  )}
                </div>
              </div>

              <div className="album-grid">
                {currentAlbum.photos.length === 0 ? (
                  <div style={{ padding: '60px', textAlign: 'center', width: '100%', gridColumn: '1 / -1', color: 'rgba(255,255,255,0.6)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>📸</div>
                    <h3>当前相册没有照片哦</h3>
                    <p>点击右上角的 "导入图片" 选择一个包含照片的本地文件夹。</p>
                  </div>
                ) : (
                  currentAlbum.photos.map((photo) => (
                    <div key={photo.id} className="photo-card" onDoubleClick={(e) => handleEditPhotoClick(e, photo)}>
                      <img src={photo.url} alt="photo" />
                      <div className="photo-desc-overlay">{photo.desc || '双击添加描述'}</div>
                      <div className="album-actions">
                        <button onClick={(e) => handleEditPhotoClick(e, photo)}>编辑描述</button>
                        <button onClick={(e) => handleDeletePhoto(e, photo.id)}>删除</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

        </div>
      )}

      {/* PLAYBACK MODE */}
      {viewMode === 'PLAY' && playSlide && (
        <div className="album-player">
          <button className="album-player-close" onClick={() => setViewMode(currentAlbumId ? 'ALBUM' : 'LIST')}>退出播放</button>

          {/* Render All Slides for Smooth Crossfade (Only show current) */}
          {slides.map((slide, i) => {
            const isActive = i === slideIndex;
            return (
              <div key={i} className={`photo-slide ${isActive ? 'active' : ''} ${isActive ? animationClass : ''} ${slide.type === 'PHOTO' ? 'layout-' + slide.layout : ''}`}>
                
                {slide.type === 'BANNER' && isActive && (
                  <div className="album-player-banner active">
                    <div className="album-player-banner-content">
                      <h1 className={textAnimationClass}>{slide.album.name}</h1>
                      <p className={textAnimationClass}>{slide.album.desc}</p>
                    </div>
                  </div>
                )}

                {slide.type === 'PHOTO' && (
                  <>
                    <img className="photo-slide-bg" src={slide.photos[0].url} alt="" />
                    {slide.photos.map((photo, pIndex) => (
                      <div className="photo-wrapper" key={pIndex}>
                        <div className="photo-inner">
                          <img className="main-img" src={photo.url} alt="" />
                          {photo.desc && (
                            <div className={`player-photo-desc ${textAnimationClass}`}>
                              {photo.desc}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}

        </div>
      )}

      {/* MODALS */}
      {isAlbumModalOpen && (
        <div className="album-modal-overlay">
          <div className="album-modal">
            <h3>新建相册</h3>
            <input 
              placeholder="相册名称" 
              value={editAlbumInfo.name} 
              onChange={e => setEditAlbumInfo({...editAlbumInfo, name: e.target.value})} 
            />
            <textarea 
              placeholder="相册描述 (可选)" 
              value={editAlbumInfo.desc} 
              onChange={e => setEditAlbumInfo({...editAlbumInfo, desc: e.target.value})} 
            />
            <div className="album-modal-actions">
              <button onClick={() => setIsAlbumModalOpen(false)}>取消</button>
              <button className="primary" onClick={handleSaveAlbum}>保存</button>
            </div>
          </div>
        </div>
      )}

      {isPhotoModalOpen && (
        <div className="album-modal-overlay">
          <div className="album-modal">
            <h3>编辑照片描述</h3>
            <textarea 
              placeholder="输入描述内容，播放时将展示在右下角" 
              value={editPhotoInfo.desc} 
              onChange={e => setEditPhotoInfo({...editPhotoInfo, desc: e.target.value})} 
              autoFocus
            />
            <div className="album-modal-actions">
              <button onClick={() => setIsPhotoModalOpen(false)}>取消</button>
              <button className="primary" onClick={handleSavePhotoDesc}>保存</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: '30px',
        right: '30px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        zIndex: 60
      }}>
        <QRCodeSVG 
          value={`http://${localIP}:5173/?server=http://${localIP}:3000`}
          size={120} 
          bgColor="#ffffff" 
          fgColor="#000000" 
          level="L" 
        />
        <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>支付宝扫码发弹幕</div>
      </div>

      {bgmUrl && <audio src={bgmUrl} loop autoPlay hidden />}
    </>
  );
}
