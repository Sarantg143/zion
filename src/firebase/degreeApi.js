import { db, storage } from './firebase';
import {collection, addDoc, getDocs, updateDoc,setDoc, doc, deleteDoc, query, where, getDoc  } from 'firebase/firestore';
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


const createTestObject = (testData) => ({
    testId: uuidv4(),
    title: testData.title,
    timeLimit: testData.timeLimit,
    type: testData.type,  
    totalMarks: 0,  
    questions: testData.questions.map((question) => {
        const questionData = {
            question: question.question,
            answerType: question.type, 
        };

        if (question.type === 'MCQ') {
            questionData.options = question.options || [];
            questionData.correctAnswer = question.correctAnswer || null;
            questionData.marks = question.marks || 1;  
            questionData.userAnswer = null;  
        } else if (question.type === 'Typed') {
            questionData.answer = question.answer || '';  
            questionData.marks = 0;   
            questionData.userAnswer = '';  
        }

        return questionData;
    }),


    calculateTotalMarks() {
        let total = 0;
        this.questions.forEach((question) => {
            if (question.answerType === 'MCQ') {
                total += question.marks;  
            } else if (question.answerType === 'Typed') {
                total += question.marks;  
            }
        });
        this.totalMarks = total; 
    },

    calculateUserMarks(userAnswers) {
        let userTotal = 0;

        this.questions.forEach((question, index) => {
            if (question.answerType === 'MCQ') {
                if (userAnswers[index].answer === question.correctAnswer) {
                    userTotal += question.marks;  
                }
            } else if (question.answerType === 'Typed') {
                if (userAnswers[index].isValidated) {
                    userTotal += question.marks; 
                }
            }
        });

        return userTotal;
    }
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

                    
                        const test = chapter.test ? createTestObject(chapter.test) : null;
                        if (test) test.calculateTotalMarks(); 

                        return {
                            chapterId: uuidv4(),
                            chapterTitle: chapter.title,
                            description: chapter.description || '',
                            test,
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
        const querySnapshot = await getDocs(collection(db, DEGREES_COLLECTION));
        const degrees = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        return degrees;
    } catch (error) {
        console.error('Error getting degrees:', error);
        throw new Error('Failed to fetch degrees');
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



const updateTest = async (testId, testData) => {
    const { title, timeLimit, type, questions } = testData;

    const formattedQuestions = questions.map((question) => {
        const questionData = {
            question: question.question,
            answerType: question.type, 
        };

        if (question.type === 'MCQ') {
            questionData.options = question.options || [];
            questionData.correctAnswer = question.correctAnswer || null;
            questionData.marks = question.marks || 1;  
            questionData.userAnswer = null;  
        } else if (question.type === 'Typed') {
            questionData.answer = question.answer || '';  
            questionData.marks = 0;   
            questionData.userAnswer = '';  
        }

        return questionData;
    });


    const testObject = {
        testId,
        title,
        timeLimit,
        type,
        totalMarks: 0,  
        questions: formattedQuestions,
    };

    testObject.calculateTotalMarks();

    return testObject;
};

export const editDegree = async (degreeId, updatedDegreeData) => {
    try {
        const degreeDocRef = doc(db, DEGREES_COLLECTION, degreeId);
        
        const {
            name,
            description,
            thumbnail,
            overviewPoints,
            courses,
        } = updatedDegreeData;

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

                        const formattedTest = chapter.test ? await updateTest(uuidv4(), chapter.test) : null;

                        return {
                            chapterId: uuidv4(),
                            chapterTitle: chapter.title,
                            description: chapter.description || '',
                            test: formattedTest,
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
                    finalTest: course.finalTest ? await updateTest(uuidv4(), course.finalTest) : null,
                    overviewPoints: course.overviewPoints.map((point) => ({
                        title: point.title,
                        description: point.description,
                    })),
                };
            })
        );

        const updatedDegree = {
            degreeTitle: name,
            description,
            thumbnail: degreeThumbnailUrl || null,
            overviewPoints: overviewPoints.map((point) => ({
                title: point.title,
                description: point.description,
            })),
            courses: formattedCourses,
            updatedAt: Date.now(),
        };

        await updateDoc(degreeDocRef, updatedDegree);
        console.log('Degree updated successfully!');
        return updatedDegree;
    } catch (error) {
        console.error('Error updating degree:', error);
        throw new Error('Degree update failed');
    }
};


export const deleteDegree = async (degreeId) => {
    try {
        const degreeDocRef = doc(db, DEGREES_COLLECTION, degreeId);
        await deleteDoc(degreeDocRef);
        console.log('Degree deleted successfully!');
    } catch (error) {
        console.error('Error deleting degree:', error);
        throw new Error('Degree deletion failed');
    }
};
