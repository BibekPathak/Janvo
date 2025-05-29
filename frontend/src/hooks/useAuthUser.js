import { useQuery } from '@tanstack/react-query';
import React from 'react'
import { getAuthUser } from '../lib/api.js';

const useAuthUser = () => {
  const authUser = useQuery({
    queryKey: ['authUser'],
    queryFn: getAuthUser,
  });

  return {isLoading: authUser.isLoading, authUser: authUser.data?.user};
}

export default useAuthUser
