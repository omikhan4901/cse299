import React, { useState, useEffect, useMemo } from 'react';
// 1. Dropdown and some icons are no longer needed
import { Layout, Menu, Button, Space, Typography } from 'antd';
import { 
    HomeOutlined, 
    UserOutlined, 
    AppstoreOutlined,
    FileTextOutlined
} from '@ant-design/icons';
import { useAuth, useRouter } from '../../Context/context-definitions';

const { Header } = Layout;
const { Title } = Typography;

const Navbar = () => {
    const { navigate, path } = useRouter();
    // 2. We just need setAuthModalOpen
    const { isAuthenticated, logout, setAuthModalOpen } = useAuth();
    
    const [current, setCurrent] = useState(path);

    useEffect(() => {
        setCurrent(path);
    }, [path]);

    const handleMenuClick = (e) => {
        navigate(e.key);
    };

    // 3. This handler is no longer needed
    // const handleDropdownClick = ({ key }) => { ... };

    // ... (menuItems definition is the same) ...
    const menuItems = useMemo(() => {
        const items = [
            { 
                label: "Home",
                key: '/', 
                icon: <HomeOutlined /> 
            },
            { 
                label: "About Us",
                key: '/about', 
                icon: <AppstoreOutlined /> 
            },
        ];

        if (isAuthenticated) {
            items.push(
                { 
                    label: "Profile",
                    key: '/profile', 
                    icon: <UserOutlined /> 
                },
                { 
                    label: "Resume Builder",
                    key: '/builder', 
                    icon: <FileTextOutlined /> 
                }
            );
        }
        return items;
    }, [isAuthenticated]);

    // 4. authMenuItems array is no longer needed
    // const authMenuItems = [ ... ];

    return (
        <Header style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f0f9f9',
            borderBottom: '1px solid #d9eaea',
            position: 'sticky',
            top: 0,
            zIndex: 200,
            width: '100%',
            padding: '0 40px', 
        }}>

            {/* --- 1. Logo (Left) --- */}
            <Title
                level={3}
                style={{
                    color: '#002A3A',
                    margin: 0,
                    cursor: 'pointer',
                    fontWeight: 700,
                    minWidth: '120px', 
                }}
                onClick={() => navigate('/')}
            >
                ResumeX
            </Title>

            {/* --- 2. Menu (Center, Expanding) --- */}
            <Menu
                theme="light"
                mode="horizontal"
                onClick={handleMenuClick}
                selectedKeys={[current]}
                items={menuItems}
                style={{
                    flex: 1, 
                    justifyContent: 'center', 
                    minWidth: 0, 
                    backgroundColor: 'transparent',
                    borderBottom: 'none',
                    lineHeight: '62px'
                }}
            />

            {/* --- 3. Auth (Right) --- */}
            <Space style={{ minWidth: '120px', justifyContent: 'flex-end' }}>
                {isAuthenticated ? (
                    <Button
                        type="primary"
                        onClick={() => logout()}
                        danger
                    >
                        Logout
                    </Button>
                ) : (
                    // 5. Replaced Dropdown with a single Button
                    <Button 
                        type="primary"
                        // It will open the modal with the 'register' tab active
                        onClick={() => setAuthModalOpen('register')}
                    >
                        Get Started
                    </Button>
                )}
            </Space>

        </Header>
    );
};

export default Navbar;