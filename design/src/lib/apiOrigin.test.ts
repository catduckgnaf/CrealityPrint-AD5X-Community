import {describe,it,expect} from "vitest";
import {isAd5xOfflineOrigin} from "./api";

describe("AD5X Design native WebView offline origin",()=>{
  it("opens the installed production editor offline without a Sculpo account",()=>{
    expect(isAd5xOfflineOrigin("127.0.0.1","18195")).toBe(true);
  });
  it("opens the isolated native acceptance editor offline without a Sculpo account",()=>{
    expect(isAd5xOfflineOrigin("127.0.0.1","18387")).toBe(true);
  });
  it("does not bypass sign-in for other hosts or ports",()=>{
    expect(isAd5xOfflineOrigin("localhost","18387")).toBe(false);
    expect(isAd5xOfflineOrigin("127.0.0.1","3000")).toBe(false);
    expect(isAd5xOfflineOrigin("example.com","18387")).toBe(false);
    expect(isAd5xOfflineOrigin("127.0.0.2","18195")).toBe(false);
  });
});
