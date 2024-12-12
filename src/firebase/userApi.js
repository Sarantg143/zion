import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import bcrypt from 'bcryptjs';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
} from 'firebase/auth';

const auth = getAuth();


export const signupUser = async (data, isGoogle = false) => {
    try {
        if (isGoogle) {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const usersRef = collection(db, 'users');
            const existingUserQuery = query(usersRef, where('email', '==', user.email));
            const existingUserSnapshot = await getDocs(existingUserQuery);

            if (!existingUserSnapshot.empty) {
                console.log('User already exists!');
                return { success: false, message: 'User already exists!' };
            }

            await addDoc(usersRef, {
                firstName: user.displayName.split(' ')[0] || '',
                lastName: user.displayName.split(' ')[1] || '',
                email: user.email,
                username: user.email.split('@')[0],
                role: 'client',
                joinedDate: Date.now(),
            });

            return { success: true, message: 'Google user signed up successfully!' };
        } else {
            const usersRef = collection(db, 'users');

            const usernameQuery = query(usersRef, where('username', '==', data.username));
            const emailQuery = query(usersRef, where('email', '==', data.email));
            const usernameSnapshot = await getDocs(usernameQuery);
            const emailSnapshot = await getDocs(emailQuery);

            if (!usernameSnapshot.empty) return { success: false, message: 'Username already exists!' };
            if (!emailSnapshot.empty) return { success: false, message: 'Email already exists!' };

            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const user = userCredential.user;

            await addDoc(usersRef, {
                email: data.email,
                username: data.username,
                role: 'client',
                joinedDate: Date.now(),
            });

            return { success: true, message: 'User signed up successfully!' };
        }
    } catch (error) {
        console.error('Error during signup:', error);
        return { success: false, message: error.message };
    }
};

export const loginUser = async (data, isGoogle = false) => {
    try {
        if (isGoogle) {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            return { success: true, user: result.user, message: 'Logged in with Google!' };
        } else {
            const usersRef = collection(db, 'users');

            let loginQuery;
            if (data.username) {
                loginQuery = query(usersRef, where('username', '==', data.username));
            } else if (data.email) {
                loginQuery = query(usersRef, where('email', '==', data.email));
            } else {
                throw new Error('Username or email is required for login.');
            }

            const loginSnapshot = await getDocs(loginQuery);
            if (loginSnapshot.empty) return { success: false, message: 'Invalid username or email.' };

            const userData = loginSnapshot.docs[0].data();

            const passwordMatch = await bcrypt.compare(data.password, userData.password);
            if (!passwordMatch) return { success: false, message: 'Incorrect password.' };

            return { success: true, user: userData, message: 'Login successful!' };
        }
    } catch (error) {
        console.error('Error during login:', error);
        return { success: false, message: error.message };
    }
};


export const forgotPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: 'Password reset email sent successfully!' };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return { success: false, message: error.message };
    }
};


export const addUserProfile = async (userId, data) => {
    try {
        const userRef = doc(db, 'users', userId);

        const signatureFile = data.signature[0];
        const signatureRef = ref(storage, `signatures/${signatureFile.name}`);
        await uploadBytes(signatureRef, signatureFile);
        const signatureURL = await getDownloadURL(signatureRef);

        const passportPhotoFile = data.passportSizePhoto[0];
        const passportPhotoRef = ref(storage, `photos/${passportPhotoFile.name}`);
        await uploadBytes(passportPhotoRef, passportPhotoFile);
        const passportPhotoURL = await getDownloadURL(passportPhotoRef);

        const educationCertFile = data.educationCertificate[0];
        const educationCertRef = ref(storage, `certificates/${educationCertFile.name}`);
        await uploadBytes(educationCertRef, educationCertFile);
        const educationCertURL = await getDownloadURL(educationCertRef);

        // Update user profile
        await updateDoc(userRef, {
            firstName: data.firstName,
            lastName: data.lastName,
            mobileNo: data.mobileNo,
            maritalStatus: data.maritalStatus,
            dob: data.dob,
            gender: data.gender,
            applyingFor: data.applyingFor,
            educationalQualification: data.educationalQualification,
            theologicalQualification: data.theologicalQualification,
            presentAddress: data.presentAddress,
            ministryExperience: data.ministryExperience,
            salvationExperience: data.salvationExperience,
            signatureURL,
            passportPhotoURL,
            educationCertURL,
        });

        console.log('User profile successfully added!');
        return { success: true, message: 'Profile updated successfully!' };
    } catch (error) {
        console.error('Error adding user profile:', error);
        return { success: false, message: error.message };
    }
};


export const addDegreeToUser = async (userId, degree) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnapshot = await getDoc(userRef);

        if (!userSnapshot.exists()) {
            return { success: false, message: 'User not found!' };
        }

        const userData = userSnapshot.data();
        const purchasedDegrees = userData.purchasedDegrees || [];

        const existingDegree = purchasedDegrees.find(d => d.degreeId === degree.degreeId);
        if (existingDegree) {
            return { success: false, message: 'Degree already added.' };
        }
        const updatedDegrees = [
            ...purchasedDegrees,
            {
                degreeId: degree.degreeId,
                degreeName: degree.degreeName,
                progress: degree.progress || 0,
            },
        ];

        await updateDoc(userRef, { purchasedDegrees: updatedDegrees });

        return { success: true, message: 'Degree added successfully!' };
    } catch (error) {
        console.error('Error adding degree:', error);
        return { success: false, message: error.message };
    }
};


export const getAllUsers = async () => {
    try {
        const data = await getDocs(collection(db, 'users'));
        return data.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(error);
    }
};


export const getUserById = async (id) => {
    try {
        const userDoc = doc(db, 'users', id);
        const userSnapshot = await getDoc(userDoc);
        return userSnapshot.exists() ? { id: userSnapshot.id, ...userSnapshot.data() } : null;
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        return null;
    }
};


export const getUsersByPurchasedDegree = async (degreeId) => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('purchasedDegrees', 'array-contains', { degreeId }));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching users by purchased degree:', error);
        return [];
    }
};


export const getUsersByRole = async (role) => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', role));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching users by role:', error);
        return [];
    }
};


export const editUser = async (id, data) => {
    try {
        await updateDoc(doc(db, 'users', id), { ...data });
        return true;
    } catch (error) {
        console.error('Error updating user:', error);
    }
};


export const deleteUser = async (id) => {
    try {
        await deleteDoc(doc(db, 'users', id));
        return true;
    } catch (error) {
        console.error('Error deleting user:', error);
    }
};