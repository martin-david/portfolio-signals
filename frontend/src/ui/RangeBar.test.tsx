import { rangeBarModel } from './RangeBar';

describe('rangeBarModel', () => {
  it('places a Smart Score of 7 on a 1 to 10 scale as the prototype does', () => {
    const model = rangeBarModel({ value: 7, min: 1, max: 10, zone: [8, 10], ticks: [5.5] });

    expect(model.track).toEqual({ x1: 4, x2: 88, y: 9 });
    expect(model.zone).toEqual({ x: 69.3, y: 4, width: 18.7, height: 10 });
    expect(model.ticks).toEqual([{ x: 46, y1: 6, y2: 12 }]);
    expect(model.mark).toEqual({ x: 58.5, y: 1, width: 3, height: 16 });
    expect(model.zero).toBeUndefined();
  });

  it('puts a reading outside the scale on its nearest end', () => {
    expect(rangeBarModel({ value: 99, min: 1, max: 10 }).mark?.x).toBe(86.5);
    expect(rangeBarModel({ value: -5, min: 1, max: 10 }).mark?.x).toBe(2.5);
  });

  it('draws the scale without a marker when there is no reading', () => {
    const model = rangeBarModel({ value: null, min: -1, max: 1, zero: 0 });

    expect(model.mark).toBeUndefined();
    expect(model.zero).toEqual({ x: 46, y1: 1, y2: 17 });
  });

  it('honours a custom size', () => {
    const model = rangeBarModel({ value: 0, min: -1, max: 1, width: 200, height: 24 });

    expect(model.track).toEqual({ x1: 4, x2: 196, y: 12 });
    expect(model.mark).toEqual({ x: 98.5, y: 1, width: 3, height: 22 });
  });
});
