/**
 * Line icons drawn with react-native-svg (24 × 24 grid, 2 pt stroke), so the
 * same glyphs render on iOS, Android, web and in Expo Go.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'search'
  | 'camera'
  | 'portfolio'
  | 'profile'
  | 'chevron'
  | 'star'
  | 'plus'
  | 'minus'
  | 'check'
  | 'eye'
  | 'eyeOff'
  | 'share'
  | 'trash'
  | 'select'
  | 'copy';

interface Props {
  name: IconName;
  color: string;
  size?: number;
  /** Filled variant, used for the active tab. */
  filled?: boolean;
}

export function Icon({ name, color, size = 24, filled = false }: Props) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const fill = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'home' && <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill={fill} {...stroke} />}
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={7} {...stroke} />
          <Path d="m20 20-4-4" {...stroke} />
        </>
      )}
      {name === 'camera' && (
        <>
          <Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" fill={fill} {...stroke} />
          <Circle cx={12} cy={13.5} r={3.5} {...stroke} stroke={filled ? '#0B0B0D' : color} />
        </>
      )}
      {name === 'portfolio' && (
        <>
          <Rect x={3} y={5} width={12} height={16} rx={2} fill={fill} {...stroke} />
          <Path d="M8 3h11a2 2 0 0 1 2 2v13" {...stroke} />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx={12} cy={8} r={4} fill={fill} {...stroke} />
          <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...stroke} />
        </>
      )}
      {name === 'chevron' && <Path d="m9 6 6 6-6 6" {...stroke} />}
      {name === 'star' && (
        <Path
          d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"
          fill={fill}
          {...stroke}
        />
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...stroke} />}
      {name === 'minus' && <Path d="M5 12h14" {...stroke} />}
      {name === 'check' && <Path d="m5 12.5 4.5 4.5L19 7.5" {...stroke} />}
      {name === 'eye' && (
        <>
          <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" {...stroke} />
          <Circle cx={12} cy={12} r={3} {...stroke} />
        </>
      )}
      {name === 'eyeOff' && (
        <>
          <Path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" {...stroke} />
          <Path d="m3 3 18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" {...stroke} />
        </>
      )}
      {name === 'share' && (
        <>
          <Path d="M12 15V3M7 8l5-5 5 5" {...stroke} />
          <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" {...stroke} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" {...stroke} />
        </>
      )}
      {name === 'select' && (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={4} {...stroke} />
          <Path d="m8 12 3 3 5-6" {...stroke} />
        </>
      )}
      {name === 'copy' && (
        <>
          <Rect x={9} y={9} width={12} height={12} rx={2.5} {...stroke} />
          <Path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" {...stroke} />
        </>
      )}
    </Svg>
  );
}
