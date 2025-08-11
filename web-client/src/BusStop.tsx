import { useLocation } from 'react-router-dom';
import HlsPlayer from './HlsPlayer';

const BusStop = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const videoSrc = queryParams.get('src');

  if (!videoSrc) {
    return <div>No video source provided. Please add ?src=YOUR_HLS_URL to the URL</div>;
  }

  return (
    <div style={{ margin: '0 auto', padding: '0px' }}>
      <HlsPlayer
        style="width: 100%, height: 100%"
        src={videoSrc} 
        autoPlay 
        muted 
        controls 
        playsInline 
      />
    </div>
  );
};

export default BusStop;