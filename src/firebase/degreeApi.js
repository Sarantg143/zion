import { db, storage } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

const DEGREES_COLLECTION = 'degrees';
const SUPPORTED_FILE_FOLDERS = {
    video: 'videos',
    audio: 'audios',
    image: 'images',
    document: 'documents',
    pdf: 'documents',
    ppt: 'presentations',
};


export const uploadThumbnail = async (file) => {
    try {
        const fileRef = ref(storage, `thumbnails/${uuidv4()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    } catch (error) {
        console.error('Error uploading thumbnail:', error);
        throw new Error('Thumbnail upload failed');
    }
};


export const uploadFile = async (file) => {
    try {
        const fileType = file.type.split('/')[0];
        const folder = SUPPORTED_FILE_FOLDERS[fileType];
        if (!folder) throw new Error(`Unsupported file type: ${file.type}`);

        const fileRef = ref(storage, `${folder}/${uuidv4()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const fileUrl = await getDownloadURL(fileRef);

        let duration = null;
        if (fileType === 'video' || fileType === 'audio') {
            duration = await getMediaDuration(file);
        }

        return {
            url: fileUrl,
            type: fileType,
            name: file.name,
            duration,
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw new Error('File upload failed');
    }
};


const getMediaDuration = (file) => {
    return new Promise((resolve) => {
        const mediaElement = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
        mediaElement.preload = 'metadata';

        const fileUrl = URL.createObjectURL(file);
        mediaElement.src = fileUrl;

        mediaElement.onloadedmetadata = () => {
            URL.revokeObjectURL(fileUrl);
            resolve(mediaElement.duration);
        };

        mediaElement.onerror = () => resolve(null);
    });
};

const createTestObject = (testData) => ({
    testId: uuidv4(),
    title: testData.title,
    timeLimit: testData.timeLimit,
    type: testData.type, 
    questions: testData.questions.map((question) => ({
        question: question.question,
        options: question.type === 'MCQ' ? question.options || [] : null,
        correctAnswer: question.type === 'MCQ' ? question.correctAnswer || null : question.correctAnswer, 
        answerType: question.type, 
    })),
});


export const addDegree = async (degreeData) => {
    try {
        const { name, description, thumbnail, overviewPoints, courses } = degreeData;

        const degreeThumbnailUrl = thumbnail ? await uploadThumbnail(thumbnail) : null;

        const formattedCourses = await Promise.all(
            courses.map(async (course) => {
                const courseThumbnailUrl = course.thumbnail ? await uploadThumbnail(course.thumbnail) : null;

                const formattedChapters = await Promise.all(
                    course.chapters.map(async (chapter) => {
                      
                        const formattedLessons = await Promise.all(
                            chapter.lessons.map(async (lesson) => {
                                const lessonFileMetadata = await uploadFile(lesson.file);

                                return {
                                    lessonId: uuidv4(),
                                    lessonTitle: lesson.title,
                                    file: lessonFileMetadata,
                                };
                            })
                        );

                        return {
                            chapterId: uuidv4(),
                            chapterTitle: chapter.title,
                            description: chapter.description || '',
                            test: chapter.test ? createTestObject(chapter.test) : null, 
                            lessons: formattedLessons,
                        };
                    })
                );

                return {
                    courseId: uuidv4(),
                    courseTitle: course.title,
                    description: course.description,
                    thumbnail: courseThumbnailUrl,
                    price: course.price,
                    chapters: formattedChapters,
                    finalTest: course.finalTest ? createTestObject(course.finalTest) : null, 
                    overviewPoints: course.overviewPoints.map((point) => ({
                        title: point.title,
                        description: point.description,
                    })),
                };
            })
        );


        const degree = {
            degreeId: uuidv4(),
            degreeTitle: name,
            description,
            thumbnail: degreeThumbnailUrl,
            overviewPoints: overviewPoints.map((point) => ({
                title: point.title,
                description: point.description,
            })),
            courses: formattedCourses,
            createdAt: Date.now(),
        };

        await addDoc(collection(db, DEGREES_COLLECTION), degree);
        console.log('Degree added successfully!');
        return degree.degreeId;
    } catch (error) {
        console.error('Error adding degree:', error);
        throw new Error('Degree saving failed');
    }
};



export const getAllDegrees = async () => {
    try {
        const degreesSnapshot = await getDocs(collection(db, DEGREES_COLLECTION));
        return degreesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching all degrees:', error);
        return [];
    }
};


export const getDegreeById = async (degreeId) => {
    try {
        const degreeQuery = query(collection(db, DEGREES_COLLECTION), where('degreeId', '==', degreeId));
        const degreeSnapshot = await getDocs(degreeQuery);

        if (degreeSnapshot.empty) throw new Error(`No degree found with ID: ${degreeId}`);
        return degreeSnapshot.docs[0].data();
    } catch (error) {
        console.error('Error fetching degree by ID:', error);
        return null;
    }
};


export const editDegree = async (degreeId, updates) => {
    try {
        const degreeQuery = query(collection(db, DEGREES_COLLECTION), where('degreeId', '==', degreeId));
        const degreeSnapshot = await getDocs(degreeQuery);

        if (degreeSnapshot.empty) throw new Error(`Degree with ID ${degreeId} not found.`);

        const degreeDocRef = degreeSnapshot.docs[0].ref;

        if (updates.newCourse) {
            updates.newCourse.courseId = uuidv4();
            updates.newCourse.thumbnail = updates.newCourse.thumbnail
                ? await uploadThumbnail(updates.newCourse.thumbnail)
                : null;
        }

        await updateDoc(degreeDocRef, updates);
        console.log('Degree updated successfully!');
        return true;
    } catch (error) {
        console.error('Error updating degree:', error);
        return false;
    }
};

export const deleteDegreeById = async (degreeId) => {
    try {
        const degreeQuery = query(collection(db, DEGREES_COLLECTION), where('degreeId', '==', degreeId));
        const degreeSnapshot = await getDocs(degreeQuery);

        if (degreeSnapshot.empty) throw new Error(`No degree found with ID: ${degreeId}`);

        const degreeDocRef = degreeSnapshot.docs[0].ref;
        await deleteDoc(degreeDocRef);

        console.log(`Degree with ID ${degreeId} deleted successfully!`);
        return { success: true, message: 'Degree deleted successfully' };
    } catch (error) {
        console.error('Error deleting degree:', error);
        return { success: false, message: 'Error deleting degree' };
    }
};
