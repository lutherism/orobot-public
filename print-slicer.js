import { sliceStl } from './print-slice.js';
import { discoverCuraProfiles } from './print-profiles.js';
import { sliceStlIdeaMaker } from './print-slice-ideamaker.js';
import { discoverIdeaMakerProfiles } from './print-profiles-ideamaker.js';

// deps is only used for testing; production callers omit it
export function getSlicer(config, { spawnFn, curaProfiles, ideamakerProfiles } = {}) {
  const slicer = config.slicer ?? 'cura';

  if (slicer === 'ideamaker') {
    return {
      slice: (stlPath, profileName) => {
        const profiles = ideamakerProfiles ?? discoverIdeaMakerProfiles(config.ideamakerProfilesDir);
        const profile = profiles.find(p => p.name === profileName);
        if (!profile) return Promise.reject(new Error(`Profile "${profileName}" not found. Run: orobot print profiles`));
        return Promise.resolve(sliceStlIdeaMaker(
          { ideamakerPath: config.ideamakerPath, stlPath, profilePath: profile.path },
          spawnFn
        ));
      },
      discoverProfiles: () => ideamakerProfiles ?? discoverIdeaMakerProfiles(config.ideamakerProfilesDir),
    };
  }

  // default: cura
  return {
    slice: (stlPath, profileName) => {
      const profiles = curaProfiles ?? discoverCuraProfiles();
      const profile = profiles.find(p => p.name === profileName);
      if (!profile) return Promise.reject(new Error(`Profile "${profileName}" not found. Run: orobot print profiles`));
      return Promise.resolve(sliceStl(
        { curaPath: config.curaPath, printerDefinition: config.printerDefinition ?? 'creality_cr30', stlPath, profileValues: profile.values },
        spawnFn
      ));
    },
    discoverProfiles: () => curaProfiles ?? discoverCuraProfiles(),
  };
}
