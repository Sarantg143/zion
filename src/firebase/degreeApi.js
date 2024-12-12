import { db, storage } from './firebase';
import { collection, doc, getDocs, query, where, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';


export const uploadFile = async (file) => {
    try {
        const supportedFolders = {
            video: 'videos',
            audio: 'audios',
            image: 'images',
            document: 'documents',
            pdf: 'documents',
            ppt: 'presentations',
        };

        const fileType = file.type.split('/')[0]; 
        const folder = supportedFolders[fileType];
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
            autoUpdate: true,
            link: fileUrl,
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

        mediaElement.onerror = () => {
            resolve(null); 
        };
    });
};


const createTestObject = (testData) => ({
    testId: uuidv4(),
    title: testData.title,
    timeLimit: testData.timeLimit,
    type: testData.type, 
    questions: testData.questions.map((question) => ({
        question: question.question,
        options: question.options || null,
        correctAnswer: question.correctAnswer || null,
    })),
});


export const addDegree = async (degreeData) => {
    try {
        const { name, description, thumbnail, overviewPoints, courses } = degreeData;

        const degreeThumbnailUrl = thumbnail ? await uploadFile(thumbnail) : null;

        const formattedCourses = await Promise.all(courses.map(async (course) => {
            const courseThumbnailUrl = course.thumbnail ? await uploadFile(course.thumbnail) : null;

            const formattedChapters = await Promise.all(course.chapters.map(async (chapter) => {
                const formattedLessons = await Promise.all(chapter.lessons.map(async (lesson) => {
                    const lessonFileMetadata = await uploadFile(lesson.file);

                    return {
                        lessonId: uuidv4(),
                        lessonTitle: lesson.title,
                        file: lessonFileMetadata,
                    };
                }));

                return {
                    chapterId: uuidv4(),
                    chapterTitle: chapter.title,
                    description: chapter.description || '',
                    test: chapter.test ? createTestObject(chapter.test) : null,
                    lessons: formattedLessons,
                };
            }));

            return {
                courseId: uuidv4(),
                courseTitle: course.title,
                description: course.description,
                thumbnail: courseThumbnailUrl,
                price: course.price,
                chapters: formattedChapters,
                finalTest: course.finalTest ? createTestObject(course.finalTest) : null,
                overviewPoints: course.overviewPoints || null,
            };
        }));

        const degree = {
            degreeId: uuidv4(),
            degreeTitle: name,
            description,
            thumbnail: degreeThumbnailUrl,
            overviewPoints: overviewPoints || null,
            courses: formattedCourses,
            createdAt: Date.now(),
        };

        await addDoc(collection(db, 'degrees'), degree);
        console.log('Degree added successfully!');
        return degree.degreeId;
    } catch (error) {
        console.error('Error adding degree:', error);
        throw new Error('Degree saving failed');
    }
};

export const getAllDegrees = async () => {
  try {
      const degreesSnapshot = await getDocs(collection(db, 'degrees'));
      const degrees = degreesSnapshot.docs.map(doc => ({
          id: doc.id, 
          ...doc.data(), 
      }));

      console.log(`${degrees.length} degrees fetched successfully!`);
      return degrees;
  } catch (error) {
      console.error('Error fetching all degrees:', error);
      return [];
  }
};

export const getDegreeById = async (degreeId) => {
    try {
        const degreesQuery = query(collection(db, 'degrees'), where('degreeId', '==', degreeId));
        const degreeSnapshot = await getDocs(degreesQuery);

        if (degreeSnapshot.empty) throw new Error(`No degree found with ID: ${degreeId}`);
        return degreeSnapshot.docs[0].data();
    } catch (error) {
        console.error('Error fetching degree by ID:', error);
        return null;
    }
};


export const editDegree = async (degreeId, updates) => {
    try {
        const degreeDocQuery = query(collection(db, 'degrees'), where('degreeId', '==', degreeId));
        const degreeSnapshot = await getDocs(degreeDocQuery);

        if (degreeSnapshot.empty) {
            throw new Error(`Degree with ID ${degreeId} not found.`);
        }

        const degreeDoc = degreeSnapshot.docs[0];
        const degreeData = degreeDoc.data();
        const degreeRef = degreeDoc.ref;

        if (updates.newCourse) {
            const newCourse = {
                courseId: uuidv4(),
                courseTitle: updates.newCourse.title,
                description: updates.newCourse.description,
                thumbnail: updates.newCourse.thumbnail ? await uploadFile(updates.newCourse.thumbnail) : null,
                price: updates.newCourse.price,
                chapters: [],
                finalTest: updates.newCourse.finalTest ? createTestObject(updates.newCourse.finalTest) : null,
                overviewPoints: updates.newCourse.overviewPoints || null,
            };

            degreeData.courses.push(newCourse);
        }

        if (updates.newChapter) {
            const { courseId, title, description } = updates.newChapter;

            const courseIndex = degreeData.courses.findIndex(course => course.courseId === courseId);
            if (courseIndex === -1) {
                throw new Error(`Course with ID ${courseId} not found.`);
            }

            const newChapter = {
                chapterId: uuidv4(),
                chapterTitle: title,
                description: description || '',
                lessons: [],
                test: null,
            };

            degreeData.courses[courseIndex].chapters.push(newChapter);
        }

        if (updates.newLesson) {
            const { courseId, chapterId, title, file } = updates.newLesson;

            const courseIndex = degreeData.courses.findIndex(course => course.courseId === courseId);
            if (courseIndex === -1) {
                throw new Error(`Course with ID ${courseId} not found.`);
            }

            const chapterIndex = degreeData.courses[courseIndex].chapters.findIndex(chapter => chapter.chapterId === chapterId);
            if (chapterIndex === -1) {
                throw new Error(`Chapter with ID ${chapterId} not found.`);
            }

            const lessonFileMetadata = await uploadFile(file);

            const newLesson = {
                lessonId: uuidv4(),
                lessonTitle: title,
                file: lessonFileMetadata,
            };

            degreeData.courses[courseIndex].chapters[chapterIndex].lessons.push(newLesson);
        }

        await updateDoc(degreeRef, degreeData);
        console.log('Degree updated successfully!');
        return true;
    } catch (error) {
        console.error('Error updating degree:', error);
        return false;
    }
};


export const deleteDegreeById = async (degreeId) => {
  try {
      const degreesQuery = query(collection(db, 'degrees'), where('degreeId', '==', degreeId));
      const degreeSnapshot = await getDocs(degreesQuery);

      if (degreeSnapshot.empty) {
          throw new Error(`No degree found with ID: ${degreeId}`);
      }

      const degreeDocRef = degreeSnapshot.docs[0].ref;
      await deleteDoc(degreeDocRef);

      console.log(`Degree with ID ${degreeId} deleted successfully!`);
      return { success: true, message: 'Degree deleted successfully' };
  } catch (error) {
      console.error('Error deleting degree:', error);
      return { success: false, message: 'Error deleting degree' };
  }
};
