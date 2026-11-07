/**
 * Line icons drawn with react-native-svg (24 × 24 grid, 2 pt stroke), so the
 * same glyphs render on iOS, Android, web and in Expo Go.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'home' | 'search' | 'camera' | 'portfolio' | 'profile' | 'chevron';

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
    </Svg>
  );
}
