export class PoseSmoother {
  private previousLandmarks: any[] = [];
  // Increased alpha to 0.6 for the UI. 
  // This provides a buttery smooth skeleton without heavy visual lag.
  private alpha: number = 0.6;

  constructor(alpha: number = 0.6) {
    this.alpha = alpha;
  }

  public smooth(currentLandmarks: any[]): any[] {
    if (!this.previousLandmarks || this.previousLandmarks.length === 0) {
      this.previousLandmarks = [...currentLandmarks];
      return currentLandmarks;
    }

    const smoothedLandmarks = currentLandmarks.map((landmark, index) => {
      const prev = this.previousLandmarks[index];

      if (!prev) return landmark;

      return {
        ...landmark,
        x: (landmark.x * this.alpha) + (prev.x * (1 - this.alpha)),
        y: (landmark.y * this.alpha) + (prev.y * (1 - this.alpha)),
        // We must pass Z through for the UI renderer so the skeleton scales correctly when turning sideways
        z: (landmark.z * this.alpha) + (prev.z * (1 - this.alpha)),
        visibility: landmark.visibility
      };
    });

    this.previousLandmarks = [...smoothedLandmarks];

    return smoothedLandmarks;
  }

  public reset() {
    this.previousLandmarks = [];
  }
}