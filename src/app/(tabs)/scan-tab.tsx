import { Redirect } from 'expo-router';

/**
 * Placeholder route for the centre Scan button. The button opens /scan
 * directly, so this screen is only reached by a deep link; send it there.
 */
export default function ScanTab() {
  return <Redirect href="/scan" />;
}
