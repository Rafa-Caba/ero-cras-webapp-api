import Choir from '../models/Choir';

const DEFAULT_CHOIR_CODE = 'eroc1';

export const ensureDefaultChoir = async (): Promise<string> => {
    let choir = await Choir.findOne({ code: DEFAULT_CHOIR_CODE });

    if (!choir) {
        choir = new Choir({
            name: 'Ero Cras',
            code: DEFAULT_CHOIR_CODE,
            isActive: true,
        });

        await choir.save();
        console.log('✅ Default choir "Ero Cras" created with code "eroc1".');
    } else {
        console.log('🟡 Default choir already exists (code "eroc1").');
    }

    const choirId = choir.id;
    return choirId;
};
